import type { GameState } from '@dugout/shared/types';
import { annualPayroll, financePlan } from '@dugout/shared/club-finance';
import { teamBudget } from '@dugout/shared/game-view';

export function prepareFinances(g: GameState, league: string) {
  if (g.finances?.year === g.year) return;
  // Sponsor agreements are fixed for a season. New signings do not increase the subsidy.
  g.finances = {
    annualSupport: Math.max(teamBudget(league) * 0.7, annualPayroll(g) * 0.85),
    year: g.year,
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
