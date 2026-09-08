import type {GameState,Player,WorldCatalog} from '../../../../packages/shared/src/types';
import {askPrice} from '../../../../packages/shared/src/game-view';
function player(p:Player):Player {const next=structuredClone(p);next.marketValue=askPrice(p);next.potential=0;if(next.rating)delete next.rating.base.potential;return next;}
export function presentState(state:GameState|null){if(!state||state.rules?.revealPotential)return state;return {...state,roster:state.roster.map(player),transferred:state.transferred.map(player),deals:state.deals.map(d=>({...d,player:player(d.player)}))};}
export function presentCareer<T extends {state:GameState|null}>(career:T):T{return {...career,state:presentState(career.state)};}
export function presentWorld(world:WorldCatalog,reveal=false):WorldCatalog{return reveal?world:{...world,players:world.players.map(player)};}
