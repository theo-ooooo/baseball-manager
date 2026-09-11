import type { GameState, WorldCatalog } from './types';
import { gameDate, addDays } from './calendar';
export function draftWindow(g: GameState, league: string, world: Pick<WorldCatalog, 'draftRules'>) {
  const rule = world.draftRules?.[league];
  const start =
    g.mode === 'short'
      ? undefined
      : rule?.year === g.year
        ? rule.date
        : `${g.year}-${league === 'mlb' ? '07-12' : league === 'npb' ? '10-20' : '09-21'}`;
  const end = start ? addDays(start, 7) : undefined;
  const open =
    g.mode === 'short'
      ? g.phase === 'finished'
      : !!start && gameDate(g) >= start && gameDate(g) <= end!;
  return {
    start,
    end,
    open,
    rounds: rule?.rounds || 3,
    label: start ? `${start} ~ ${end}` : '단축 시즌 종료 후',
    basis: rule?.year === g.year ? '공식 개최일 기준 · 지명 진행 8일' : '게임 내 지정 기간',
  };
}
