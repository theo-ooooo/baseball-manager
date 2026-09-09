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
