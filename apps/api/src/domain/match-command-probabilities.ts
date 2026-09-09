import type { Player } from '@dugout/shared/types';
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const readiness = (p: Player) => 0.7 + p.condition * 0.003;
export function stealChance(runner: Player, pitcher: Player, catcher: number, third = false) {
  return clamp(
    0.3 +
      runner.speed * readiness(runner) * 0.007 -
      pitcher.control * 0.001 -
      catcher * 0.001 -
      (third ? 0.12 : 0),
    0.15,
    0.88,
  );
}
export function buntResult(batter: Player, defense: number, familiarity: number, roll: number) {
  const hit = clamp(0.02 + batter.speed * readiness(batter) * 0.0005, 0.025, 0.07);
  const execute = clamp(
    0.35 +
      batter.contact * readiness(batter) * 0.004 +
      familiarity * 0.001 -
      (defense - 50) * 0.002,
    0.3,
    0.9,
  );
  return roll < hit ? 'hit' : roll < execute ? 'sacrifice' : roll > 0.94 ? 'strikeout' : 'out';
}
