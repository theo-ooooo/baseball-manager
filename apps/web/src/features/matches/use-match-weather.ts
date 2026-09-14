import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import { matchWeather } from '@dugout/shared/match-weather';
import { postseasonFixtures } from '@dugout/shared/postseason';
import { preseasonFixtures } from '@dugout/shared/management';
import { useWorld } from '../career/world-context';

export function useMatchWeather(g: GameState) {
  const { clubs, getClub, ownFixtures } = useWorld(),
    today = gameDate(g);
  if (g.phase === 'preseason') {
    const friendly = preseasonFixtures(g, { clubs }).find((f) => f.day === g.day);
    return friendly
      ? {
          weather: matchWeather(
            g,
            { home: friendly.pair[0], date: today },
            getClub(friendly.pair[0]),
          ),
          confirmed: false,
        }
      : null;
  }
  const fixture = (
    g.phase === 'regular'
      ? ownFixtures(g)
      : postseasonFixtures(g, getClub(g.club).league).filter(
          (f) => f.date === today && f.status === 'scheduled',
        )
  ).find((f) => f.home === g.club || f.away === g.club);
  if (fixture)
    return { weather: matchWeather(g, fixture, getClub(fixture.home)), confirmed: false };
  const cancelled = Object.values(g.weather?.postponed || {}).find(
    (entry) =>
      (entry.fixture.home === g.club || entry.fixture.away === g.club) &&
      entry.cancellations.some((cancel) => cancel.date === today),
  );
  if (cancelled)
    return {
      weather: cancelled.cancellations.find((cancel) => cancel.date === today)!.weather,
      confirmed: true,
      date: cancelled.fixture.date,
    };
  return null;
}
