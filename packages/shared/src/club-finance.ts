import type { GameState } from './types';
import { teamBudget } from './game-view';

export function annualPayroll(g: GameState) {
  return (
    g.roster.reduce((sum, p) => sum + p.salary, 0) +
    g.staff.reduce((sum, c) => sum + c.salary, 0) +
    (g.managerCareer?.status === 'employed' ? g.managerCareer.contract?.salary || 0 : 0)
  );
}
export function financePlan(g: GameState, league: string) {
  const days = Math.max(1, g.finances?.days ?? g.rounds + (g.rules?.preseason ? 28 : 0) + 8);
  return {
    days,
    dailyWages: annualPayroll(g) / days,
    dailySupport: (g.finances?.annualSupport ?? teamBudget(league) * 0.7) / days,
  };
}

/** Fixed seasonal allowance; future signings cannot increase board approval. */
export function financeAssessment(g: GameState, league: string, payroll = annualPayroll(g)) {
  const plan = financePlan(g, league);
  const wageBudget =
    g.finances?.wageBudget ??
    Math.max(1, ((g.finances?.annualSupport ?? teamBudget(league) * 0.7) / 0.85) * 1.1);
  const remainingDays = Math.max(0, plan.days - (g.finances?.settledDays || 0));
  const projectedCash = g.budget + remainingDays * (plan.dailySupport - payroll / plan.days);
  const extraSpending = Math.max(0, g.expenses - (g.finances?.paidWages || 0));
  const spendingBudget = teamBudget(league) * 0.5;
  const wagePenalty = Math.min(25, Math.ceil(Math.max(0, payroll / wageBudget - 1) * 50));
  const cashPenalty = g.budget < 0 ? 15 : projectedCash < 0 ? 8 : 0;
  const spendingPenalty = Math.min(
    15,
    Math.ceil(Math.max(0, extraSpending / spendingBudget - 1) * 10),
  );
  const penalty = wagePenalty + cashPenalty + spendingPenalty;
  return {
    payroll,
    wageBudget,
    projectedCash,
    extraSpending,
    spendingBudget,
    penalty,
    status: penalty >= 20 ? '지출 개선 요구' : penalty > 0 ? '주의 관찰' : '예산 준수',
    reasons: [
      wagePenalty ? '승인 급여 예산 초과' : '',
      cashPenalty ? '운영 자금 부족 우려' : '',
      spendingPenalty ? '계약·시설 등 추가 지출 과다' : '',
    ].filter(Boolean),
  };
}
