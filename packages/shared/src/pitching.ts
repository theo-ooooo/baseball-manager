import type {GameState,Player,PitchingPlan} from './types';
import {overall} from './game-view';
import {firstTeam} from './management';

export function starterScore(p:Player){const r=p.rating?.record;return r?.outs&&r.g?Math.min(7,r.outs/3/r.g)*12+overall(p)*.25:overall(p);}
export function autoPitching(players:Player[]):PitchingPlan{
 const pitchers=players.filter(p=>p.pos==='P');
 const starters=[...pitchers].sort((a,b)=>starterScore(b)-starterScore(a)).slice(0,Math.min(5,Math.max(1,pitchers.length-2)));
 const relief=pitchers.filter(p=>!starters.includes(p)).sort((a,b)=>(b.rating?.record?.sv||0)-(a.rating?.record?.sv||0)||overall(b)-overall(a));
 return {rotation:starters.map(p=>p.id),closer:relief[0]?.id||'',bullpen:relief.slice(1).map(p=>p.id),next:0};
}
export function preparePitching(g:GameState){
 const active=firstTeam(g).filter(p=>p.pos==='P'),valid=new Set(active.map(p=>p.id));
 if(!g.pitching){
  g.pitching=autoPitching(active);
  // Preserve a legacy save's explicitly chosen starter.
  if(valid.has(g.starter)&&!g.pitching.rotation.includes(g.starter))g.pitching.rotation=[g.starter,...g.pitching.rotation.slice(0,4)];
  if(g.pitching.rotation.includes(g.pitching.closer))g.pitching.closer=active.filter(p=>!g.pitching!.rotation.includes(p.id)).sort((a,b)=>(b.rating?.record?.sv||0)-(a.rating?.record?.sv||0)||overall(b)-overall(a))[0]?.id||'';
  g.pitching.next=Math.max(0,g.pitching.rotation.indexOf(g.starter));
 }
 const plan=g.pitching;plan.rotation=plan.rotation.filter(id=>valid.has(id));
 if(!plan.rotation.length)plan.rotation=[autoPitching(active).rotation[0]].filter(Boolean);
 if(!valid.has(plan.closer)||plan.rotation.includes(plan.closer))plan.closer='';
 plan.bullpen=active.filter(p=>!plan.rotation.includes(p.id)&&p.id!==plan.closer).map(p=>p.id);
 plan.next=Math.max(0,Math.floor(plan.next||0))%Math.max(1,plan.rotation.length);
 if(!valid.has(g.starter))g.starter=plan.rotation[plan.next];
 if(g.defense)g.defense.P=g.starter;
}
export function nextStarter(g:GameState,played=false){preparePitching(g);const plan=g.pitching!;if(played){const at=plan.rotation.indexOf(g.starter);plan.next=(at>=0?at+1:plan.next)%plan.rotation.length;}
 const order=[...plan.rotation.slice(plan.next),...plan.rotation.slice(0,plan.next)];
 g.starter=order.find(id=>(g.roster.find(p=>p.id===id)?.condition||0)>=65)||order[0];if(g.defense)g.defense.P=g.starter;
}
export function pitchingRole(g:GameState,p:Player){if(p.pos!=='P')return '';const plan=g.pitching;if(plan?.rotation.includes(p.id))return `선발 ${plan.rotation.indexOf(p.id)+1}`;return plan?.closer===p.id?'마무리':'불펜';}
