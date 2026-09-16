import type { GameState, Result } from './types';
import { gameDate } from './calendar';

/** Simulated world scores have no innings or archived play-by-play to request. */
export function hasMatchReplay(result: Result) {
  return result.log.length > 0 || result.innings.length > 0;
}

/** Preserve the manager's archive, but present results for the current club, including before appointment. */
export function clubResults(g: GameState) {
  const seen = new Set<string>();
  return [...g.history, ...(g.worldResults || [])]
    .filter((result) => {
      if (result.home !== g.club && result.away !== g.club) return false;
      const key = result.fixtureId
        ? `${result.fixtureId}:${result.date || gameDate(g, result.day)}`
        : result.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.date || gameDate(g, b.day)).localeCompare(a.date || gameDate(g, a.day)));
}
