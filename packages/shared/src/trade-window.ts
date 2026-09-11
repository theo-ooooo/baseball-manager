import type { GameState } from './types';
import { gameDate, addDays } from './calendar';
export function tradeWindow(g: GameState, league: string) {
  const cutoff =
    g.mode !== 'short'
      ? league === 'mlb' && g.year === 2026
        ? '08-03'
        : ['kbo', 'npb', 'mlb'].includes(league)
          ? '07-31'
          : null
      : null;
  const date = cutoff
    ? `${g.year}-${cutoff}`
    : g.calendar?.openingDate
      ? addDays(g.calendar.openingDate, Math.floor(g.rounds * 0.8) - 1)
      : undefined;
  const closed =
    g.phase === 'preseason' || g.phase === 'finished'
      ? false
      : g.phase !== 'regular'
        ? true
        : cutoff
          ? gameDate(g) > `${g.year}-${cutoff}`
          : g.day >= Math.floor(g.rounds * 0.8);
  return {
    closed,
    date,
    label:
      g.phase === 'preseason' || g.phase === 'finished'
        ? '비시즌 · 트레이드 가능'
        : closed
          ? '이번 시즌 트레이드 마감'
          : date
            ? `${date}까지 트레이드 가능`
            : '시즌 일정 80% 지점에서 마감',
  };
}
