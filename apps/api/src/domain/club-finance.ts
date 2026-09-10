import type { GameState } from '@dugout/shared/types';
import { annualPayroll, financePlan, financeAssessment } from '@dugout/shared/club-finance';
import { postNews } from './club-dynamics';
import { money, teamBudget } from '@dugout/shared/game-view';

export function prepareFinances(g: GameState, league: string) {
  if (g.finances?.year === g.year) {
    if (g.finances.balanceVersion !== 2) {
      // Update future installments only; never rewrite wages, contracts or earlier cash.
      g.finances.wageBudget ??= Math.max(1, (g.finances.annualSupport / 0.85) * 1.1);
      g.finances.annualSupport *= 0.95 / 0.85;
      g.finances.balanceVersion = 2;
    }
    return;
  }
  // Sponsor agreements are fixed for a season. New signings do not increase the subsidy.
  g.finances = {
    annualSupport: Math.max(teamBudget(league) * 0.7, annualPayroll(g) * 0.95),
    year: g.year,
    balanceVersion: 2,
    wageBudget: annualPayroll(g) * 1.1,
    settledDays: 0,
    paidWages: 0,
    receivedSupport: 0,
  };
}
export function settleClubDay(g: GameState, league: string) {
  prepareFinances(g, league);
  const plan = financePlan(g, league);
  // A season has a bounded wage/support schedule, including its playoff allowance.
  if (g.finances!.settledDays >= plan.days) return;
  g.finances!.settledDays++;
  g.finances!.paidWages += plan.dailyWages;
  g.finances!.receivedSupport += plan.dailySupport;
  g.budget += plan.dailySupport - plan.dailyWages;
  g.income += plan.dailySupport;
  g.expenses += plan.dailyWages;
  if (g.managerCareer?.status === 'employed')
    g.managerCareer.earnings += (g.managerCareer.contract?.salary || 0) / plan.days;
}

export function reviewFinances(g: GameState, league: string) {
  prepareFinances(g, league);
  const assessment = financeAssessment(g, league);
  const f = g.finances!;
  if (
    !assessment.penalty ||
    (f.lastWarningDay !== undefined &&
      g.day - f.lastWarningDay < 7 &&
      assessment.penalty <= (f.lastWarningPenalty || 0))
  )
    return assessment;
  f.lastWarningDay = g.day;
  f.lastWarningPenalty = assessment.penalty;
  postNews(
    g,
    `이사회 · ${assessment.status}`,
    `${assessment.reasons.join(' · ')}. 총 연봉 ${money(assessment.payroll)} / 승인 급여 ${money(assessment.wageBudget)}. 재정 평가에 따라 감독 신뢰도에 ${assessment.penalty}점 감점이 반영됩니다. 지출을 개선하면 감점도 줄어듭니다.`,
    'manager',
    { actionView: 'finance' },
  );
  return assessment;
}
