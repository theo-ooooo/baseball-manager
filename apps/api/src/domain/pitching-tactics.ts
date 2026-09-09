import type { PitchingApproach } from '@dugout/shared/pitching-tactics';
const neutral = { walk: 0, contact: 0, homeRun: 0, strikeout: 0, doublePlay: 0 };
/** Bounded game-model tradeoffs; no extra random draws for a tactical instruction. */
export function pitchingModifiers(approach: PitchingApproach, control: number) {
  if (approach === 'attack')
    return { walk: -0.018, contact: 0.014, homeRun: 0.018, strikeout: -0.04, doublePlay: 0 };
  if (approach === 'corners') {
    const precision = Math.max(0.3, Math.min(1, control / 85));
    return {
      walk: 0.02 + (1 - precision) * 0.025,
      contact: -0.025 * precision,
      homeRun: -0.025 * precision,
      strikeout: 0.065 * precision,
      doublePlay: 0,
    };
  }
  if (approach === 'groundball')
    return { walk: 0.005, contact: 0.015, homeRun: -0.045, strikeout: -0.065, doublePlay: 0.15 };
  return neutral;
}
