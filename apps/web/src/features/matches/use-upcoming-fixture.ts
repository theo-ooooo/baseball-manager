import { isPostseasonPhase } from '@dugout/shared/postseason';
import type { GameState } from '@dugout/shared/types';
import { postseasonFixtures } from '@dugout/shared/postseason';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';

export function useUpcomingFixture(g: GameState) {
  const { fixtures, getClub, nextFixture } = useWorld();
  if (g.phase === 'regular' || isPostseasonPhase(g.phase)) {
    const today = gameDate(g);
    const done = new Set(g.history.map((result) => result.fixtureId));
    const candidates =
      g.phase === 'regular'
        ? fixtures(g, getClub(g.club).league)
        : postseasonFixtures(g, getClub(g.club).league).filter((f) => f.status === 'scheduled');
    const fixture = candidates.find(
      (fixture) =>
        (fixture.home === g.club || fixture.away === g.club) &&
        fixture.date > today &&
        !done.has(fixture.id),
    );
    return fixture
      ? { day: g.day + daysBetween(today, fixture.date), pair: [fixture.home, fixture.away] }
      : null;
  }
  if (g.phase === 'preseason') {
    for (let day = g.day + 1; day < 0; day++) {
      const pair = nextFixture({ ...g, day });
      if (pair) return { day, pair };
    }
  }
  return null;
}
