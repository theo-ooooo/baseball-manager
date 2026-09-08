import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const out=join(tmpdir(),'dugout-live-test.cjs');
buildSync({entryPoints:['tests/fixtures/engine.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
const {engine:e}=createRequire(import.meta.url)(out);
test('Live game starts without outcomes, persists one PA at a time and commits the completed game once',()=>{
 let g=e.newGame('kbo-lotte','Live','short',321);g=e.applyAction(g,{type:'continue'});assert.equal(g.day,-22);
 const initial=structuredClone(g);g=e.applyAction(g,{type:'startMatch'});assert.equal(g.liveMatch.result.log.length,0);assert.equal(g.history.length,0);assert.equal(g.liveMatch.result.homeScore,0);
 assert.throws(()=>e.applyAction(g,{type:'advance',count:1}),/진행 중/);assert.throws(()=>e.applyAction(g,{type:'completeMatch'}),/끝까지/);
 g=e.applyAction(g,{type:'stepMatch'});assert.equal(g.liveMatch.result.log.length,1);assert.equal(g.day,-22);assert.deepEqual(g.roster.map(p=>p.stats),initial.roster.map(p=>p.stats));
 const restored=JSON.parse(JSON.stringify(g));assert.deepEqual(e.applyAction(restored,{type:'stepMatch'}).liveMatch,e.applyAction(g,{type:'stepMatch'}).liveMatch);
 let steps=0;while(!g.liveMatch.finished&&steps++<400)g=e.applyAction(g,{type:'stepMatch'});assert.ok(g.liveMatch.finished);assert.equal(g.history.length,0);
 const final=structuredClone(g.liveMatch.result);const pitchers=new Set(final.log.filter(x=>x.play).map(x=>x.play.pitcher));assert.ok(pitchers.size>=4);
 g=e.applyAction(g,{type:'completeMatch'});assert.equal(g.liveMatch,undefined);assert.equal(g.history.length,1);assert.equal(g.day,-21);assert.equal(g.history[0].homeScore,final.homeScore);assert.equal(g.history[0].awayScore,final.awayScore);assert.deepEqual(g.history[0].log,final.log);assert.throws(()=>e.applyAction(g,{type:'completeMatch'}),/끝까지/);
});
test('Pitcher roles use disjoint groups and can be reassigned',()=>{
 let g=e.newGame('kbo-lotte','Pitching','short',51);const p=g.pitching;
 assert.equal(p.rotation.length,5);assert.ok(p.closer);assert.ok(p.bullpen.length);
 assert.equal(new Set([...p.rotation,...p.bullpen,p.closer]).size,p.rotation.length+p.bullpen.length+1);
 const next=p.bullpen[0],old=p.closer;g=e.applyAction(g,{type:'pitchingRole',id:next,role:'closer'});assert.equal(g.pitching.closer,next);assert.ok(g.pitching.bullpen.includes(old));
 assert.throws(()=>e.applyAction(g,{type:'pitchingRole',id:g.lineup[0],role:'starter'}),/보직/);
});
