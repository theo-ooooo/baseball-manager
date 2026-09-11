import type { Player } from './types';
import { detailedAttributes } from './player-attributes';
import { abilityText } from './ratings';
import { overall } from './game-view';
export function visibleOverall(p: Player): number | undefined {
  if (p.observation)
    return p.observation.overall
      ? (p.observation.overall[0] + p.observation.overall[1]) / 2
      : undefined;
  return overall(p);
}
/** Every profile summary uses the same visible information as the scout report, never hidden values. */
export function profileAttributes(p: Player) {
  return detailedAttributes(p).map((a) => {
    const range = p.observation && a.key ? p.observation.abilities?.[a.key] : undefined;
    const value = p.observation
      ? range
        ? (range[0] + range[1]) / 2
        : null
      : a.value === null
        ? null
        : a.key
          ? p[a.key]
          : a.value;
    return {
      ...a,
      value,
      text: p.observation ? (range ? range.map(abilityText).join('–') : '?') : abilityText(value),
    };
  });
}
export function playerAssessment(p: Player) {
  const attributes = profileAttributes(p);
  const evaluated = attributes
    .filter((a): a is typeof a & { value: number } => a.value !== null)
    .sort((a, b) => b.value - a.value);
  return {
    attributes,
    strengths: evaluated.slice(0, 2),
    concern: evaluated.length >= 3 && evaluated.at(-1)!.value < 70 ? evaluated.at(-1) : undefined,
    basis: p.observation
      ? p.observation.date
        ? `${p.observation.date} 관찰 평가`
        : '관찰 정보 없음'
      : p.rating?.record
        ? `${p.rating.record.season} 공식 성적 기반 게임 평가`
        : p.real
          ? '실적 자료 부족 · 게임 추정 오버롤'
          : '게임 내 평가',
  };
}
