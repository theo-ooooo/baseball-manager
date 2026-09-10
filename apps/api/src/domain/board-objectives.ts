import type { GameState, WorldCatalog } from '@dugout/shared/types';
import type { BoardObjective } from '@dugout/shared/manager-career';
import { boardObjectiveLabels, boardProgress } from '@dugout/shared/manager-career';
import { createGameView, teamBudget, money } from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';
export function resetBoardBaseline(g: GameState) {
  const o = g.managerCareer?.contract?.objective;
  if (!o || o.year === g.year) return;
  o.year = g.year;
  o.baseline = baseline(g);
  o.recordedAppearances = { total: 0, youth: 0 };
}
function baseline(g: GameState): BoardObjective['baseline'] {
  return {
    wages: g.roster.reduce((s, p) => s + p.salary, 0),
    profit: g.income - g.expenses,
    appearances: g.roster.reduce((s, p) => s + p.stats.g, 0),
    youth: g.roster.filter((p) => p.age <= 23).reduce((s, p) => s + p.stats.g, 0),
  };
}
export function boardFailure(g: GameState) {
  const o = g.managerCareer?.contract?.objective;
  return o && o.year === g.year && boardProgress(g, o) + 0.001 < o.target
    ? `${boardObjectiveLabels[o.kind]} 목표 미달 (${boardProgress(g, o).toFixed(1)} / ${o.target.toFixed(1)})`
    : '';
}
export function boardAction(g: GameState, a: Record<string, unknown>, world: WorldCatalog) {
  if (a.type !== 'boardNegotiate') return null;
  const c = g.managerCareer?.contract;
  if (!c || g.managerCareer?.status !== 'employed')
    throw new Error('취임 후 구단주와 협상할 수 있습니다.');
  if (g.liveMatch || g.managerCareer.vacationUntil || (g.day >= 0 && c.signed !== gameDate(g)))
    throw new Error('개막 전 또는 취임 당일에 협상해 주세요.');
  if (c.negotiatedYear === g.year) throw new Error('이번 시즌 추가 지원을 이미 합의했습니다.');
  const kind = a.objective as BoardObjective['kind'],
    benefit = a.benefit;
  if (
    !['youth', 'wages', 'profit'].includes(kind) ||
    !['funds', 'training'].includes(String(benefit))
  )
    throw new Error('운영 목표와 지원 조건을 선택해 주세요.');
  const league = createGameView(world).getClub(g.club).league;
  const max = Math.max(1, Math.floor(world.clubs.filter((x) => x.league === league).length / 2));
  const rank = Number(a.targetRank);
  if (!Number.isInteger(rank) || rank < 1 || rank > max || rank > c.targetRank)
    throw new Error(`현재 순위 목표를 유지하거나 높여 상위 ${max}위 이내를 약속해 주세요.`);
  const funds = Math.round(teamBudget(league) * 0.1);
  if (benefit === 'training') {
    g.facilities ??= { training: 1, medical: 1 };
    if (g.facilities.training >= 5) throw new Error('훈련시설은 최고 단계입니다.');
    g.facilities.training++;
  } else {
    g.budget += funds;
    g.income += funds;
  }
  c.targetRank = rank;
  c.negotiatedYear = g.year;
  c.benefit = benefit as 'funds' | 'training';
  c.objective = {
    kind,
    year: g.year,
    target: kind === 'youth' ? 15 : kind === 'wages' ? 10 : Math.round(teamBudget(league) * 0.05),
    baseline: baseline(g),
    recordedAppearances: { total: 0, youth: 0 },
  };
  postNews(
    g,
    '구단주 추가 지원 합의',
    `${rank}위 이내와 ${boardObjectiveLabels[kind]} ${kind === 'profit' ? money(c.objective.target) : `${c.objective.target}%`} 목표를 약속했습니다. ${benefit === 'funds' ? `${money(funds)} 지원금 입금` : '훈련시설 1단계 개선 · 성장 효과 증가'}. 순위 또는 운영 목표 미달 시 계약이 종료됩니다.`,
    'manager',
    { actionView: 'manager' },
  );
  return g;
}

export function recordBoardAppearances(g: GameState, before: Map<string, number>) {
  const o = g.managerCareer?.contract?.objective;
  if (!o?.recordedAppearances || o.year !== g.year) return;
  for (const p of g.roster) {
    const delta = Math.max(0, p.stats.g - (before.get(p.id) || 0));
    o.recordedAppearances.total += delta;
    if (p.age <= 23) o.recordedAppearances.youth += delta;
  }
}
