import type { FreeAgentTerms, GameState, Player, Stats } from '@dugout/shared/types';
import { overall, teamBudget } from '@dugout/shared/game-view';
import { playerPersonality } from '@dugout/shared/personality';

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
/** Game valuation, independent of the player's previous contract and hidden potential. */
export function freeAgentValuation(
  g: GameState,
  p: Player,
  league: string,
  previous?: Stats,
): FreeAgentTerms {
  const stats = (p.pos === 'P' ? p.stats.outs > 0 : p.stats.ab > 0) ? p.stats : previous;
  let form = 0;
  if (stats && p.pos === 'P' && stats.outs > 0) {
    const era = (stats.er * 27) / stats.outs;
    form = clamp((4.2 - era) / 12, -0.2, 0.2) * Math.min(1, stats.outs / 90);
  } else if (stats && stats.ab > 0) {
    form =
      clamp((stats.h / stats.ab - 0.26) * 2 + (stats.hr / stats.ab - 0.03) * 2, -0.2, 0.2) *
      Math.min(1, stats.ab / 120);
  }
  const age = p.age > 31 ? Math.max(0.55, 1 - (p.age - 31) * 0.045) : p.age < 25 ? 1.03 : 1;
  const personality = playerPersonality(p);
  const ambition = Math.max(
    0,
    overall(p) - g.reputation - 4 + Math.max(0, personality.ambition - 70) / 5,
  );
  const base = teamBudget(league) * 0.028 * Math.pow(overall(p) / 80, 6);
  const value =
    base *
    age *
    (1 + form) *
    (0.94 + personality.money / 500) *
    (1 + Math.min(0.3, ambition * 0.015));
  return {
    salary:
      Math.round(clamp(value, teamBudget(league) * 0.001, teamBudget(league) * 0.09) * 100) / 100,
    years: p.age >= 35 ? 1 : 2,
    basis: `영입 리그의 연봉 수준 · 현재 기량 · 나이${stats && (stats.ab > 0 || stats.outs > 0) ? ' · 최근 출전 성적' : ''} · 선수의 계약 성향`,
  };
}
