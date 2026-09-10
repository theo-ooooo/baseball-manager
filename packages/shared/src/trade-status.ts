import type { TradeOffer } from './long-term';
import type { GameState, NewsItem } from './types';
import { gameDate } from './calendar';

export const tradeStatusLabels = {
  pending: '구단 검토 중',
  accepted: '구단 수락 · 최종 확정 대기',
  counter: '역제안 · 감독 확인 필요',
  rejected: '거절',
  completed: '교환 완료',
  withdrawn: '철회',
  expired: '기한 만료',
} as const;

export function tradeStatus(g: GameState, offer: TradeOffer): TradeOffer['status'] {
  return ['pending', 'accepted', 'counter'].includes(offer.status) && gameDate(g) > offer.expires
    ? 'expired'
    : offer.status;
}

export function isActiveTrade(g: GameState, offer: TradeOffer) {
  return ['pending', 'accepted', 'counter'].includes(tradeStatus(g, offer));
}

export function tradeNeedsConfirmation(g: GameState, offer: TradeOffer) {
  return (
    g.managerCareer?.status !== 'unemployed' &&
    ['accepted', 'counter'].includes(tradeStatus(g, offer))
  );
}

export function presentTradeNews(
  news: NewsItem,
  g: GameState,
  clubName: (id: string) => string,
): NewsItem {
  if (news.actionView !== 'trade' || news.tradeId || news.employmentClosed || !news.date)
    return news;
  const candidates = (g.trades || []).filter(
    (offer) =>
      news.title === `${clubName(offer.club)} · 트레이드` &&
      offer.date <= news.date! &&
      news.date! <= offer.expires,
  );
  const offer = candidates.length === 1 ? candidates[0] : undefined;
  // Overlapping old proposals without identifiers cannot be assigned safely to one offer.
  return offer ? { ...news, tradeId: offer.id } : news;
}
