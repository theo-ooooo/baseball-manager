import type { Fixture, GameState, WorldCatalog } from '@dugout/shared/types';
import { addDays, createCalendarView, daysBetween, gameDate } from '@dugout/shared/calendar';
import { canPlayWeather, cancellationLabel, matchWeather } from '@dugout/shared/match-weather';
import { currentPostseasonRound, type PostseasonFixture } from '@dugout/shared/postseason';
import { postNews } from './club-dynamics';

export function prepareWeather(g: GameState) {
  if (!g.weather || g.weather.year !== g.year)
    g.weather = { version: 1, year: g.year, seed: g.seed, fromDay: g.day, postponed: {} };
}

export function postponeForWeather(g: GameState, fixture: Fixture, world: WorldCatalog): boolean {
  const home = world.clubs.find((club) => club.id === fixture.home);
  if (!g.weather || canPlayWeather(g, fixture, home)) return false;
  const weather = matchWeather(g, fixture, home);
  if (!weather.cancellation) return false;
  const date = fixture.date;
  let nextDate = addDays(date, 1);
  if ('post' in fixture) {
    // Shift all remaining games in this series together; the next round waits for both winners.
    const current = fixture as PostseasonFixture;
    for (const next of currentPostseasonRound(g)!.fixtures) {
      if (
        next.seriesIndex !== current.seriesIndex ||
        ['completed', 'cancelled'].includes(next.status) ||
        next.game < current.game
      )
        continue;
      next.date = addDays(next.date, 1);
      if (g.weather.postponed[next.id]) g.weather.postponed[next.id].fixture.date = next.date;
    }
  } else {
    const calendar = createCalendarView(world);
    const occupied = new Set(
      calendar
        .fixtures(g, fixture.league)
        .filter(
          (other) =>
            other.id !== fixture.id &&
            [other.home, other.away].some((club) => club === fixture.home || club === fixture.away),
        )
        .map((other) => other.date),
    );
    let searched = 0;
    while (occupied.has(nextDate) && searched++ < 730) nextDate = addDays(nextDate, 1);
    if (occupied.has(nextDate)) throw new Error('재편성 가능한 날짜를 찾지 못했습니다.');
    if (world.clubs.find((club) => club.id === g.club)?.league === fixture.league)
      g.rounds = Math.max(g.rounds, daysBetween(gameDate(g, 0), nextDate) + 1);
  }
  const previous = g.weather.postponed[fixture.id];
  g.weather.postponed[fixture.id] = {
    fixture: { ...fixture, date: nextDate },
    cancellations: [
      ...(previous?.cancellations || []),
      { date, reason: weather.cancellation, weather },
    ],
  };
  if (fixture.home === g.club || fixture.away === g.club) {
    const away = world.clubs.find((club) => club.id === fixture.away)!;
    postNews(
      g,
      `${cancellationLabel(weather.cancellation)} · ${nextDate.slice(5)} 재편성`,
      `${date} ${away.name} vs ${home!.name} 경기는 ${weather.cancellation === 'rain' ? '강한 비' : '그라운드 배수·정비 사정'}로 취소됐습니다. ${nextDate} 같은 홈 구장에서 다시 치릅니다. 경기 기록과 승패는 반영하지 않습니다.`,
      'match',
      { actionView: 'schedule', sender: { name: '경기 운영팀', role: '일정 변경' } },
    );
  }
  return true;
}
