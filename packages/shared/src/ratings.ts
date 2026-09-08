import type {Player} from './types';
import {overall} from './game-view';
export const isUnrated=(p:Player)=>p.real&&(!p.rating||p.rating.status==='missing');
export const ratingText=(p:Player)=>isUnrated(p)?'미평가':`${overall(p)}${p.rating?.status==='provisional'?'*':''}`;
export const potentialText=(p:Player)=>isUnrated(p)?'미평가':p.real?`${Math.round(p.potential)} · 추정`:String(Math.round(p.potential));
