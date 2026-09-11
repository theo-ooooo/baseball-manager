import type { Player } from '@dugout/shared/types';
import { overall } from '@dugout/shared/game-view';
/** Presentation only: never round the stored ability used by the simulation. */
export const abilityText = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '미평가' : String(Number(value.toFixed(2)));
export const isUnrated = (p: Player) => p.real && (!p.rating || p.rating.status === 'missing');
export const ratingText = (p: Player) =>
  p.observation
    ? p.observation.overall?.join('–') || '?'
    : isUnrated(p)
      ? '미평가'
      : `${overall(p)}${p.rating?.status === 'provisional' ? '*' : ''}`;
export const potentialText = (p: Player) =>
  p.observation
    ? '?'
    : isUnrated(p)
      ? '미평가'
      : p.real
        ? `${Math.round(p.potential)} · 추정`
        : String(Math.round(p.potential));
