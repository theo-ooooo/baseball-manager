import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import { askPrice } from '@dugout/shared/game-view';
function player(p: Player, reveal = false, state?: CatalogKnowledge | null): Player {
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
  const known = state && p.club === state.club;
  if (!known && !state?.knowledge?.clubs.includes(p.club)) {
    const report = state?.scouting?.reports.find((r) => r.playerId === p.id);
    next.observation = report
      ? {
          status: 'scouted',
          overall: report.overall,
          abilities: report.abilities,
          date: report.date,
        }
      : { status: 'unknown' };
    for (const key of [
      'contact',
      'power',
      'speed',
      'field',
      'stuff',
      'control',
      'potential',
    ] as const)
      next[key] = 0;
    if (next.rating) next.rating = { ...next.rating, base: {} };
    delete next.development;
    delete next.trainingPlan;
    delete next.familiarity;
    delete next.positionTraining;
  }
  return next;
}
export function presentState(state: GameState | null): GameState | null {
  if (!state) return null;
  const next = { ...state };
  if (state.scouting) {
    next.scouting = {
      ...state.scouting,
      assignments: state.scouting.assignments.map((task) => {
        const visible = { ...task };
        delete visible.candidateIds;
        return visible;
      }),
    };
  }
  // Frozen simulation inputs are server-only, even in a revealed career.
  if (state.liveMatch) {
    next.liveMatch = { ...state.liveMatch };
    delete next.liveMatch.opponents;
    delete next.liveMatch.prepared;
  }
  const reveal = state.rules?.revealPotential === true;
  next.roster = state.roster.map((p) => player(p, reveal, state));
  next.transferred = state.transferred.map((p) => player(p, reveal, state));
  next.deals = state.deals.map((d) => ({ ...d, player: player(d.player, reveal, state) }));
  return next;
}
export function presentCareer<T extends { state: GameState | null }>(
  career: T,
  compact = false,
): T {
  const state = presentState(career.state);
  // Mutation responses need scores and reports; full archived play-by-play is loaded on demand.
  // This projection never changes the durable save or an active match's timeline.
  if (compact && state)
    state.history = state.history.map((result) => ({ ...result, log: [], replayTeams: undefined }));
  return { ...career, state };
}
export type CatalogKnowledge = Pick<GameState, 'club' | 'rules' | 'knowledge' | 'scouting'>;
const catalogViews = new WeakMap<WorldCatalog, Map<string, WorldCatalog>>();
export function presentWorld(
  world: WorldCatalog,
  reveal = false,
  state?: CatalogKnowledge | null,
): WorldCatalog {
  const league = world.clubs.find((c) => c.id === state?.club)?.league;
  const leagues = state?.knowledge?.leagues ?? (league ? [league] : []);
  const key = `${reveal}:${[...leagues].sort().join(',')}`;
  let cache = catalogViews.get(world);
  if (!cache) {
    cache = new Map();
    catalogViews.set(world, cache);
  }
  let base = cache.get(key);
  if (!base) {
    // This cache contains only shared visibility policy, never a user's reports or career.
    const context = {
      club: '',
      knowledge: {
        leagues,
        clubs: world.clubs.filter((c) => leagues.includes(c.league)).map((c) => c.id),
      },
    };
    base = { ...world, players: world.players.map((p) => player(p, reveal, context)) };
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, base);
  }
  if (!state?.scouting?.reports.length) return base;
  const reports = new Map(state.scouting.reports.map((r) => [r.playerId, r]));
  return {
    ...base,
    players: base.players.map((p) => {
      const report = reports.get(p.id);
      return p.observation && report
        ? {
            ...p,
            observation: {
              status: 'scouted',
              overall: report.overall,
              abilities: report.abilities,
              date: report.date,
            },
          }
        : p;
    }),
  };
}
