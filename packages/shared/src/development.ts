import type { AbilityKey, Player } from './types';
export const abilityKeys: AbilityKey[] = ['contact', 'power', 'speed', 'field', 'stuff', 'control'];
export const abilityLabels: Record<AbilityKey, string> = {
  contact: '타격',
  power: '장타',
  speed: '주력',
  field: '수비',
  stuff: '구위',
  control: '제구',
};
export const growthLabels = { growth: '성장기', peak: '전성기', decline: '하락기' };
export const growthPatterns = {
  early: '조숙형',
  steady: '균형형',
  late: '만성형',
  durable: '장수형',
};
export function abilityAverage(p: Player) {
  return p.pos === 'P'
    ? p.stuff * 0.58 + p.control * 0.42
    : p.contact * 0.4 + p.power * 0.3 + p.speed * 0.12 + p.field * 0.18;
}
export function developmentChange(p: Player) {
  const history = p.development?.history;
  if (!history?.length) return null;
  const baseline = history.length > 1 ? history.at(-2)! : history[0];
  return abilityAverage(p) - baseline.overall;
}
