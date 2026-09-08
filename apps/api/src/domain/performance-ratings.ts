import type {Player,PerformanceRecord,RatingEvidence} from '../../../../packages/shared/src/types';
import {overall} from '../../../../packages/shared/src/game-view';
const bounded=(n:number)=>Math.round(Math.max(20,Math.min(99,n)));
export const ratingKeys=['contact','power','speed','field','stuff','control','potential'] as const;
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
/** Transparent, deterministic model. No name-based overrides or random real-player attributes. */
export function rateRealPlayers(players:Player[],records:PerformanceRecord[]){
 const index=new Map<string,PerformanceRecord[]>();for(const r of records){const key=normal(r.name)+':'+r.kind;index.set(key,[...(index.get(key)||[]),r]);}
 for(const p of players){if(!p.real)continue;
  const matches=(index.get(normal(p.original)+':'+(p.pos==='P'?'pitch':'bat'))||[]).filter(r=>!r.ambiguous);
  // A name must resolve uniquely; ambiguous same-name identities remain ungraded.
  const r=matches.length===1?matches[0]:matches.find(r=>r.league===p.club.split('-')[0]);
  const sample=r?(p.pos==='P'?(r.outs||0)/3:r.pa||0):0;
  const missing=!r||sample===0;
  const evidence:RatingEvidence={version:'performance-2025-v2',status:missing?'missing':sample<(p.pos==='P'?30:100)?'provisional':'rated',season:2025,source:r?.source,record:r,method:'시즌 성적 · 표본 보정 v2 · 출루·주루 기록 확장',estimatedAttributes:p.pos==='P'?['수비','주력']:['수비',...(r?.sb===undefined?['주력']:[])],base:{}};
  // Unobserved tools use a neutral simulation baseline, hidden from scouting displays.
  Object.assign(p,{contact:50,power:50,speed:50,field:50,stuff:50,control:50,potential:50});
  if(!missing&&r){
   const peers=records.filter(v=>v.league===r.league&&v.kind===r.kind);
   const sum=(key:keyof PerformanceRecord)=>peers.reduce((s,v)=>s+(typeof v[key]==='number'?Number(v[key]):0),0);
   const reliability=sample/(sample+(p.pos==='P'?35:150));
   const blend=(value:number,mean:number)=>mean+(value-mean)*reliability;
   if(p.pos==='P'){
    const innings=(r.outs||0)/3,meanIP=sum('outs')/3;
    const era=(r.er||0)*9/innings,k9=(r.k||0)*9/innings,bb9=(r.bb||0)*9/innings;
    const meanERA=sum('er')*9/meanIP,meanK=sum('k')*9/meanIP,meanBB=sum('bb')*9/meanIP;
    p.stuff=bounded(65+(blend(k9,meanK)-meanK)*5+(meanERA-blend(era,meanERA))*4);
    p.control=bounded(65+(meanBB-blend(bb9,meanBB))*9+(meanERA-blend(era,meanERA))*3);
   }else{
    const ab=Math.max(1,r.ab||0),pa=Math.max(1,r.pa||0),meanAVG=sum('h')/Math.max(1,sum('ab')),meanISO=(sum('tb')-sum('h'))/Math.max(1,sum('ab'));
    p.contact=bounded(65+(blend((r.h||0)/ab,meanAVG)-meanAVG)*260);
    p.power=bounded(65+(blend(((r.tb||0)-(r.h||0))/ab,meanISO)-meanISO)*175);
    if(r.sb!==undefined){const meanSB=sum('sb')/Math.max(1,sum('pa'));p.speed=bounded(55+(blend(r.sb/pa,meanSB)-meanSB)*550);}
    // Current rating evaluates batting performance; unmeasured defense stays neutral.
   }
   const current=overall(p),ageBonus=p.ageEstimated?0:Math.max(0,Math.min(8,(28-p.age)*.9));
   p.potential=bounded(current+ageBonus*(.5+.5*reliability));
  }
  evidence.base=Object.fromEntries(ratingKeys.map(k=>[k,p[k]]));p.rating=evidence;
 }
}
export function refreshRatings(player:Player,catalog:Player){
 if(!player.real||!catalog.rating||player.rating?.version===catalog.rating.version)return;
 for(const k of ratingKeys){const growth=player.rating?.base[k]===undefined?0:player[k]-player.rating.base[k]!;player[k]=bounded(catalog[k]+growth);}
 player.potential=Math.max(overall(player),player.potential);player.rating=structuredClone(catalog.rating);
}
