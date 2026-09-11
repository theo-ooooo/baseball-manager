import type { AbilityKey, GameState, Player } from '@dugout/shared/types';

export function specialistSkill(g: GameState, role: string) {
  const coach = g.staff.find(
    (c) => c.role === role && (c.contractUntil === undefined || c.contractUntil > g.year),
  );
  return Math.max(0, Math.min(100, coach?.skill || 0));
}

/** Optional appointments supplement normal training. Empty posts preserve existing development. */
export function specialistTraining(g: GameState, p: Player, key: AbilityKey) {
  let bonus = specialistSkill(g, '수석') * 0.0008;
  if ((p.pos === 'C' && key === 'field') || (p.pos === 'P' && key === 'control'))
    bonus += specialistSkill(g, '배터리') * 0.0015;
  if (p.pos !== 'P' && key === 'speed') bonus += specialistSkill(g, '주루·작전') * 0.0015;
  if (
    p.pos === 'P' &&
    ['stuff', 'control'].includes(key) &&
    !(g.pitching?.rotation || [g.starter]).includes(p.id)
  )
    bonus += specialistSkill(g, '불펜') * 0.0015;
  return 1 + Math.min(0.35, bonus);
}
