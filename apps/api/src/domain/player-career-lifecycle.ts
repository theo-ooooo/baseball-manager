import type { Player } from '@dugout/shared/types';
import { hash, overall } from '@dugout/shared/game-view';

/** Game decisions, not predictions about the real player's career. */
export function playerRetires(p: Player, year: number) {
  if (p.years > 1 || p.age < 38) return false;
  if (p.age >= 45) return true;
  const active = p.pos === 'P' ? p.stats.outs > 0 : p.stats.ab > 0;
  const useful = overall(p) >= 65;
  if (active && useful && p.age < 41) return false;
  const chance = Math.min(45, (p.age - 37) * 5) * (active && useful ? 0.25 : useful ? 0.5 : 1);
  return hash(`${p.id}:${year}:retire`) % 100 < chance;
}

export function aiRenewalYears(p: Player, year: number) {
  if (p.age >= 35) return overall(p) >= 65 && p.age < 40 ? 2 : 1;
  return 2 + (hash(`${p.id}:${year}:renew`) % (overall(p) >= 70 ? 4 : 2));
}
