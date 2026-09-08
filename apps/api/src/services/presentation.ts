import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import { askPrice } from '@dugout/shared/game-view';
function player(p: Player, reveal = false): Player {
  const next = { ...p };
  next.marketValue = askPrice(p);
  if (!reveal) {
    next.potential = 0;
    if (next.rating) {
      next.rating = { ...next.rating, base: { ...next.rating.base } };
      delete next.rating.base.potential;
    }
  }
  if (next.development) {
    next.development = { ...next.development };
    delete next.development.curve;
  }
  return next;
}
export function presentState(state: GameState | null): GameState | null {
  if (!state) return null;
  const next = { ...state };
  // Frozen simulation inputs are server-only, even in a revealed career.
  if (state.liveMatch) {
    next.liveMatch = { ...state.liveMatch };
    delete next.liveMatch.opponents;
    delete next.liveMatch.prepared;
  }
  const reveal = state.rules?.revealPotential === true;
  next.roster = state.roster.map((p) => player(p, reveal));
  next.transferred = state.transferred.map((p) => player(p, reveal));
  next.deals = state.deals.map((d) => ({ ...d, player: player(d.player, reveal) }));
  return next;
}
export function presentCareer<T extends { state: GameState | null }>(career: T): T {
  return { ...career, state: presentState(career.state) };
}
const hiddenCatalogs = new WeakMap<WorldCatalog, WorldCatalog>();
export function presentWorld(world: WorldCatalog, reveal = false): WorldCatalog {
  if (reveal) return world;
  let hidden = hiddenCatalogs.get(world);
  if (!hidden) {
    hidden = { ...world, players: world.players.map((p) => player(p)) };
    hiddenCatalogs.set(world, hidden);
  }
  return hidden;
}
