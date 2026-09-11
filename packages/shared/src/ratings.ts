import type { Player } from '@dugout/shared/types';
import { overall } from '@dugout/shared/game-view';
/** Presentation only: never round the stored ability used by the simulation. */
export const abilityText = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '미평가' : String(Number(value.toFixed(2)));
export const isUnrated = (p: Player) => p.real && (!p.rating || p.rating.status === 'missing');
export const ratingText = (p: Player) =>
  p.observation
    ? p.observation.overall?.join('–') || '?'
    : `${overall(p)}${isUnrated(p) || ['provisional', 'estimated'].includes(p.rating?.status || '') ? '*' : ''}`;
export const ratingBasis = (p: Player) =>
  p.observation
    ? '스카우트 관찰 범위'
    : isUnrated(p) || p.rating?.status === 'estimated'
      ? '게임 생성 능력 · 자료가 부족해 선수별 고정 난수로 채운 추정치입니다.'
      : p.rating?.status === 'provisional'
        ? '표본이 적은 잠정 평가'
        : '게임 내 종합 능력';
export const potentialText = (p: Player) =>
  p.observation
    ? '?'
    : p.real
      ? `${Math.round(p.potential)} · 추정`
      : String(Math.round(p.potential));
