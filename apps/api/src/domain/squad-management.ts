import {prepareCalendar} from '../../../../packages/shared/src/calendar';
import type {DefensivePosition,GameState,Player,TeamInstructions,WorldCatalog} from '../../../../packages/shared/src/types';
import {blankStats,coachSkill,hash,lineupAuto,overall} from '../../../../packages/shared/src/game-view';
import {autoDefense,defaults,defenseFor,defensivePositions,familiarity,firstTeam,reserveTeam,selectFirstTeam} from '../../../../packages/shared/src/management';
import {refreshRatings} from './performance-ratings';
import {createPlayerGenerator} from './player-generator';

export function prepareSquad(g:GameState,world:WorldCatalog){
 prepareCalendar(g,world);
 if(g.catalogVersion!==world.version){
  const catalog=new Map(world.players.map(p=>[p.id,p]));
  for(const p of [...g.roster,...g.transferred]){const base=catalog.get(p.id);if(base)refreshRatings(p,base);}
  for(const d of g.deals){const base=catalog.get(d.player.id);if(base)refreshRatings(d.player,base);}
  // Add newly catalogued players without changing contracts or undoing transfers in a save.
  const known=new Set([...g.roster,...g.transferred].map(p=>p.id));
  for(const p of world.players.filter(p=>p.real&&p.club===g.club)){
   if(g.roster.length>=85)break;
   if(!known.has(p.id)&&!g.ownership[p.id]&&!g.roster.some(v=>v.real&&v.original===p.original&&v.pos===p.pos&&v.number===p.number))g.roster.push({...structuredClone(p),squad:'reserve'});
  }
  g.catalogVersion=world.version;
 }
 if(!g.reserve){
  const {makePlayer}=createPlayerGenerator(world);
  selectFirstTeam(g);
  // Every club begins with enough academy players to field a separate development team.
  let i=1200;
  for(const [pos,min] of [['P',5],['C',1],['IF',4],['OF',3],['DH',1]] as const){
   while(reserveTeam(g).filter(p=>p.pos===pos).length<min&&g.roster.length<85){const p=makePlayer(g.club,i++,undefined,g.year);p.pos=pos;p.squad='reserve';if(pos==='P'){p.stuff=p.contact;p.control=p.field;}g.roster.push(p);}
  }
  g.reserve={w:0,l:0,d:0,history:[]};
 }
 g.instructions??=defaults(g.tactic);g.tacticFamiliarity??=55;g.tacticBook??=[];g.defense=defenseFor(g);
}
function activePlayer(g:GameState,id:unknown){const p=firstTeam(g).find(p=>p.id===id);if(!p)throw new Error('1군에 등록된 선수를 선택해 주세요.');return p;}
function repair(g:GameState){g.lineup=lineupAuto(firstTeam(g));if(!firstTeam(g).some(p=>p.id===g.starter))g.starter=firstTeam(g).find(p=>p.pos==='P')!.id;g.defense=autoDefense(g);}
export function canRemove(g:GameState,p:Player){
 if(p.squad==='reserve')return;
 const active=firstTeam(g);const min={P:7,C:1,IF:4,OF:3,DH:0}[p.pos];
 if(active.length<=22||active.filter(v=>v.pos===p.pos).length<=min)throw new Error('1군 경기 편성에 필요한 선수가 부족합니다. 같은 포지션 선수를 먼저 올려 주세요.');
}
export function managementAction(g:GameState,a:Record<string,unknown>):GameState|null {
 switch(a.type){
  case 'syncCatalog':return g;
  case 'squad':{
   const p=g.roster.find(p=>p.id===a.id);if(!p||!['first','reserve'].includes(String(a.value)))throw new Error('선수와 등록 구분을 확인해 주세요.');
   if((p.squad||'first')===a.value)return g;
   if(a.value==='first'&&firstTeam(g).length>=28)throw new Error('1군 정원은 28명입니다. 먼저 한 명을 2군으로 내려 주세요.');
   if(a.value==='reserve')canRemove(g,p);
   p.squad=a.value as 'first'|'reserve';repair(g);return g;
  }
  case 'defense':{
   const p=activePlayer(g,a.id),pos=String(a.position) as DefensivePosition;
   if(!defensivePositions.includes(pos)||(pos==='P')!==(p.pos==='P'))throw new Error('투수는 마운드에, 야수는 야수 포지션에 배치해 주세요.');
   const d=defenseFor(g);if(d[pos]===p.id)return g;
   if(pos==='P'){g.starter=p.id;d.P=p.id;}else{
    const prior=defensivePositions.find(k=>d[k]===p.id);const displaced=d[pos];
    if(prior)d[prior]=displaced;
    else g.lineup=g.lineup.map(id=>id===displaced?p.id:id);
    d[pos]=p.id;
   }
   g.defense=d;g.tacticFamiliarity=Math.max(20,(g.tacticFamiliarity||55)-2);return g;
  }
  case 'positionTraining':{
   const p=g.roster.find(p=>p.id===a.id),pos=String(a.position) as DefensivePosition;
   if(!p||!defensivePositions.includes(pos)||(pos==='P')!==(p.pos==='P'))throw new Error('훈련할 포지션을 확인해 주세요.');
   p.positionTraining=pos;return g;
  }
  case 'instructions':{
   const input=a.value as TeamInstructions;const keys=['steal','patience','power','depth'] as const;
   if(!input||keys.some(k=>!Number.isFinite(input[k])||input[k]<0||input[k]>100))throw new Error('전술 수치는 0~100 사이여야 합니다.');
   const old=g.instructions||defaults(g.tactic);const change=keys.reduce((s,k)=>s+Math.abs(input[k]-old[k]),0)/20;
   g.instructions=Object.fromEntries(keys.map(k=>[k,Math.round(input[k])])) as TeamInstructions;g.tacticFamiliarity=Math.max(20,(g.tacticFamiliarity||55)-change);return g;
  }
  case 'saveTactic':{
   const name=typeof a.name==='string'?a.name.trim().slice(0,30):'';if(!name)throw new Error('전술 이름을 입력해 주세요.');
   const book=g.tacticBook||[];const old=book.find(t=>t.name===name);
   if(!old&&book.length>=5)throw new Error('전술은 5개까지 저장할 수 있습니다. 기존 전술을 삭제하거나 같은 이름으로 저장하세요.');
   const saved={id:old?.id||`tactic-${g.year}-${hash(name)}`,name,tactic:g.tactic,lineup:[...g.lineup],starter:g.starter,defense:{...defenseFor(g)},instructions:{...(g.instructions||defaults(g.tactic))}};
   g.tacticBook=[...book.filter(t=>t.name!==name),saved];return g;
  }
  case 'loadTactic':{
   const t=g.tacticBook?.find(t=>t.id===a.id);if(!t)throw new Error('저장한 전술을 찾을 수 없습니다.');
   for(const id of [...t.lineup,t.starter])activePlayer(g,id);
   g.lineup=[...t.lineup];g.starter=t.starter;g.defense={...t.defense};g.tactic=t.tactic;g.instructions={...t.instructions};g.tacticFamiliarity=Math.max(20,(g.tacticFamiliarity||55)-8);return g;
  }
  case 'deleteTactic':g.tacticBook=(g.tacticBook||[]).filter(t=>t.id!==a.id);return g;
  default:return null;
 }
}
export function developSquad(g:GameState,random:()=>number,opponents:string[]){
 g.tacticFamiliarity=Math.min(100,(g.tacticFamiliarity||55)+(g.training==='rest'?.15:.7));
 const d=defenseFor(g);
 for(const p of g.roster){
  const pos=p.positionTraining||defensivePositions.find(k=>d[k]===p.id);
  if(pos&&g.training!=='rest'){p.familiarity??={};p.familiarity[pos]=Math.min(100,familiarity(p,pos)+.12+coachSkill(g,'수비')/400);}
 }
 if(g.day%3!==0||!['preseason','regular'].includes(g.phase)||!g.reserve)return;
 const roster=reserveTeam(g),lineup=lineupAuto(roster).map(id=>roster.find(p=>p.id===id)!);
 const pitcher=roster.filter(p=>p.pos==='P').sort((a,b)=>b.condition-a.condition||overall(b)-overall(a))[0];
 if(lineup.length<9||!pitcher||!lineup.some(p=>p.pos==='C'))return;
 let hits=0,own=0;const played:Player[]=[];
 for(const p of lineup){
  p.reserveStats??=blankStats();const s=p.reserveStats;s.g++;played.push(p);
  for(let i=0;i<4;i++){if(random()<.08){s.bb++;continue;}s.ab++;if(random()<.23+(p.contact-60)*.003){s.h++;hits++;if(random()<.10+(p.power-60)*.002){s.hr++;s.rbi++;own++;}}else if(random()<.3)s.k++;}
  p.condition=Math.max(25,p.condition-5);
 }
 const otherRuns=Math.floor(hits*(.2+random()*.3));own+=otherRuns;for(let i=0;i<otherRuns;i++)lineup[Math.floor(random()*9)].reserveStats!.rbi++;
 const against=Math.max(0,Math.round(random()*8+(65-overall(pitcher))*.08));
 pitcher.reserveStats??=blankStats();Object.assign(pitcher.reserveStats,{g:pitcher.reserveStats.g+1,outs:pitcher.reserveStats.outs+27,er:pitcher.reserveStats.er+against,wins:pitcher.reserveStats.wins+(own>against?1:0)});pitcher.condition=Math.max(20,pitcher.condition-42);played.push(pitcher);
 const reserveDefense=autoDefense({...g,roster,lineup:lineup.map(p=>p.id),starter:pitcher.id,defense:undefined});
 for(const pos of defensivePositions){const p=roster.find(p=>p.id===reserveDefense[pos]);if(p){p.familiarity??={};p.familiarity[pos]=Math.min(100,familiarity(p,pos)+.2);}}
 for(const p of played)if(p.age<28&&g.training!=='rest'){const skill=p.pos==='P'?'stuff':'contact';if(p[skill]<p.potential)p[skill]=Math.min(p.potential,p[skill]+.08+coachSkill(g,p.pos==='P'?'투수':'타격')/600);}
 if(own>against)g.reserve.w++;else if(own<against)g.reserve.l++;else g.reserve.d++;
 g.reserve.history.unshift({day:g.day,opponent:opponents[Math.abs(g.day)%opponents.length],own,against,played:played.map(p=>p.id)});g.reserve.history=g.reserve.history.slice(0,60);
}
