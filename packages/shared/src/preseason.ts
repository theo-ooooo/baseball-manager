import type { GameState } from './types';
import { gameDate } from './calendar';

/** Days between the optional preseason start and opening day. */
export const PRESEASON_DAYS = 28;

export type PreseasonSkipBlocker = {
  kind: 'managerOffer' | 'deal' | 'coachDeal' | 'saleOffer' | 'draft' | 'trade';
  id: string;
  /** Club id for offers, player or coach name for negotiations. */
  subject: string;
};

const blockerLabels: Record<PreseasonSkipBlocker['kind'], string> = {
  managerOffer: '감독 면접·계약 제안',
  deal: '선수 계약 답변',
  coachDeal: '코치 계약 답변',
  saleOffer: '선수 매각 제안',
  draft: '진행 중인 신인 선발',
  trade: '트레이드 답변',
};

/**
 * Manager decisions that a coach may not take on the manager's behalf.
 * Skipping the remaining preseason refuses while any exist, and stops when one arrives,
 * so no offer expires or is accepted without the manager seeing it.
 */
export function preseasonSkipBlockers(g: GameState): PreseasonSkipBlocker[] {
  const today = gameDate(g);
  const list: PreseasonSkipBlocker[] = [];
  for (const o of g.managerCareer?.offers || [])
    if (['invited', 'interview', 'offered'].includes(o.status) && o.expires >= today)
      list.push({ kind: 'managerOffer', id: o.id, subject: o.club });
  const awaiting = (d: { status: string; year?: number; day: number; expires?: number }) =>
    ['counter', 'accepted'].includes(d.status) &&
    (d.year === undefined || d.year === g.year) &&
    g.day <= (d.expires ?? d.day + 14);
  for (const d of g.deals)
    if (awaiting(d)) list.push({ kind: 'deal', id: d.id, subject: d.player.name });
  for (const d of g.coachDeals || [])
    if (awaiting(d)) list.push({ kind: 'coachDeal', id: d.id, subject: d.coach.name });
  for (const o of g.saleOffers || [])
    if (o.year === g.year && o.expires >= g.day)
      list.push({
        kind: 'saleOffer',
        id: o.id,
        subject: g.roster.find((p) => p.id === o.playerId)?.name || o.playerId,
      });
  if (g.draft?.status === 'open' && g.draft.year === g.year)
    list.push({ kind: 'draft', id: `draft-${g.draft.year}`, subject: g.draft.league });
  for (const offer of g.trades || [])
    if (['accepted', 'counter'].includes(offer.status) && offer.expires >= today)
      list.push({ kind: 'trade', id: offer.id, subject: offer.club });
  return list;
}

/** One-line summary such as "감독 면접·계약 제안 1건, 선수 계약 답변 2건". */
export function describePreseasonSkipBlockers(blockers: PreseasonSkipBlocker[]) {
  const counts = new Map<PreseasonSkipBlocker['kind'], number>();
  for (const b of blockers) counts.set(b.kind, (counts.get(b.kind) || 0) + 1);
  return [...counts].map(([kind, n]) => `${blockerLabels[kind]} ${n}건`).join(', ');
}
