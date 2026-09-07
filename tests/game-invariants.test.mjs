import {strict as assert} from 'node:assert';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {test} from 'node:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out=join(tmpdir(),'dugout-engine-test.cjs');
buildSync({entryPoints:['tests/fixtures/engine.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
const require=createRequire(import.meta.url);
const {engine:e,world:{clubs,leagues}}=require(out);
test('Renewals preserve performance accumulated since the offer, and catalog templates stay unchanged',()=>{
  let g=e.newGame('mlb-dodgers','Test','short',19);
  const player=g.roster.find(p=>p.id===g.lineup[0]);
  g=e.negotiate(g,player.id,player.salary*2,3,'renew');
  const id=g.deals[0].id;
  // Simulate the save/load boundary before another match is played.
  g=structuredClone(g);
  g=e.advance(g,1);
  const current=g.roster.find(p=>p.id===player.id);
  const stats=structuredClone(current.stats), condition=current.condition;
  assert.ok(stats.ab>0);
  g=e.signDeal(g,id);
  const renewed=g.roster.find(p=>p.id===player.id);
  assert.deepEqual(renewed.stats,stats);assert.equal(renewed.condition,condition);
  assert.equal(e.newGame('mlb-dodgers','Other','short',19).roster.find(p=>p.id===player.id).stats.ab,0);
});
test('Every league, including odd club counts, completes all short-season fixtures',()=>{
  let g=e.newGame('kbo-lg','Test','short',51);
  while(g.phase==='regular')g=e.advance(g,7);
  for(const l of leagues){
    const count=clubs.filter(c=>c.league===l.id).length;
    for(const row of g.standings[l.id])assert.equal(row.w+row.l+row.d,(count-1)*2,l.id+':'+row.club);
  }
});
test('All playable clubs have legal, unique lineups and a starting pitcher',()=>{for(const club of clubs){const g=e.newGame(club.id,'Test','short',42);assert.equal(new Set(g.roster.map(p=>p.id)).size,g.roster.length,club.id);assert.equal(new Set(g.lineup).size,9,club.id);assert.ok(g.roster.find(p=>p.id===g.starter&&p.pos==='P'));e.applyAction(g,{type:'lineup',ids:g.lineup});for(const p of g.roster)assert.ok(Number.isFinite(e.overall(p))&&p.salary>0);}});
test('Round robin including odd leagues gives every pair home and away with no duplicate fixture',()=>{for(const l of leagues){const cs=clubs.filter(c=>c.league===l.id);const rounds=(cs.length%2?cs.length:cs.length-1)*2,seen=new Set;for(let day=0;day<rounds;day++){const used=new Set;for(const [h,a] of e.pairings(l.id,day)){assert.ok(!used.has(h)&&!used.has(a));used.add(h);used.add(a);assert.ok(!seen.has(h+':'+a),l.id);seen.add(h+':'+a);}}assert.equal(seen.size,cs.length*(cs.length-1),l.id);}});
test('Match scoring, stats, world standings and next season remain consistent',()=>{let g=e.newGame('kbo-lg','Test','short',129);let safe=0;while(g.phase!=='finished'&&safe++<12)g=e.advance(g,7);assert.equal(g.phase,'finished');assert.ok(g.champion);assert.equal(g.past.length,1);for(const rows of Object.values(g.standings)){assert.equal(rows.reduce((s,r)=>s+r.w,0),rows.reduce((s,r)=>s+r.l,0));assert.equal(rows.reduce((s,r)=>s+r.rf,0),rows.reduce((s,r)=>s+r.ra,0));}for(const r of g.history){assert.equal(r.awayScore,r.innings[0].reduce((s,n)=>s+(n||0),0));assert.equal(r.homeScore,r.innings[1].reduce((s,n)=>s+(n||0),0));assert.ok(r.innings[0].length>=9);assert.equal(r.log.at(-1).score[0],r.awayScore);assert.equal(r.log.at(-1).score[1],r.homeScore);}for(const p of g.roster){assert.ok(p.stats.h<=p.stats.ab);assert.ok(p.stats.hr<=p.stats.h);assert.ok(p.condition<=100&&p.condition>=0);}g=e.nextSeason(g);assert.equal(g.year,2027);assert.equal(g.day,0);assert.equal(g.phase,'regular');assert.equal(g.lineup.length,9);assert.ok(g.roster.some(p=>!p.real&&p.id.includes('2027')));e.applyAction(g,{type:'lineup',ids:g.lineup});});
test('Agent negotiation, signing, resale and coach hiring update actual resources',()=>{let g=e.newGame('mlb-dodgers','Test','short',9);const p=e.marketPlayers(g).find(p=>p.club==='fa');const before=g.budget;g=e.negotiate(g,p.id,p.salary*2,3);assert.notEqual(g.deals[0].status,'rejected');const d=g.deals[0];g=e.signDeal(g,d.id);assert.ok(g.roster.some(x=>x.id===p.id));assert.equal(g.budget,before-d.fee-d.agentFee-d.salary*.15);assert.throws(()=>e.signDeal(g,d.id));g=e.sellPlayer(g,p.id);assert.ok(!g.roster.some(x=>x.id===p.id));assert.ok(e.marketPlayers(g).some(x=>x.id===p.id));const coach=e.coachPool(g.year).find(c=>c.role==='투수'&&c.skill>85);g=e.applyAction(g,{type:'coach',id:coach.id});assert.equal(e.coachSkill(g,'투수'),coach.skill);assert.equal(g.staff.length,5);assert.throws(()=>e.negotiate(g,p.id,-100,3));assert.throws(()=>e.negotiate(g,p.id,20,99));});
