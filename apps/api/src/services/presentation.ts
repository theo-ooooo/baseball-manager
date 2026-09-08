import type {GameState,Player,WorldCatalog} from '../../../../packages/shared/src/types';
import {askPrice} from '../../../../packages/shared/src/game-view';
function player(p:Player):Player {
 const next=structuredClone(p);next.marketValue=askPrice(p);next.potential=0;
 if(next.rating)delete next.rating.base.potential;
 return next;
}
export function presentState(state:GameState|null):GameState|null {
 if(!state)return null;
 const next={...state};
 // Frozen simulation inputs are server-only, even in a revealed career.
 if(state.liveMatch){const {opponents:_,...live}=state.liveMatch;next.liveMatch=live;}
 if(!state.rules?.revealPotential){
  next.roster=state.roster.map(player);next.transferred=state.transferred.map(player);
  next.deals=state.deals.map(d=>({...d,player:player(d.player)}));
 }
 return next;
}
export function presentCareer<T extends {state:GameState|null}>(career:T):T{return {...career,state:presentState(career.state)};}
export function presentWorld(world:WorldCatalog,reveal=false):WorldCatalog{return reveal?world:{...world,players:world.players.map(player)};}
