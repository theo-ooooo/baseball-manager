import { daysBetween, gameDate } from './calendar';
import type { GameState } from './types';
import { tradeWindow } from './trade-window';
export type DeadlineListing = {
  id: string;
  seller: string;
  player: { id: string; name: string; pos: string; age: number };
  rival: { club: string; player: { id: string; name: string }; cash: number };
  opened: string;
  closes: string;
  status: 'open' | 'won' | 'lost' | 'cancelled';
  result?: string;
};
export type DeadlineMarket = {
  club: string;
  year: number;
  opened: string;
  listings: DeadlineListing[];
};
export function deadlineCountdown(g: GameState, league: string) {
  const window = tradeWindow(g, league),
    remaining = window.date ? daysBetween(gameDate(g), window.date) : undefined;
  return {
    ...window,
    remaining,
    active:
      g.phase === 'regular' &&
      !window.closed &&
      remaining !== undefined &&
      remaining >= 0 &&
      remaining <= 7,
  };
}
export function deadlineOffer(g: GameState, listing: DeadlineListing) {
  return g.trades?.find(
    (o) =>
      o.deadline?.id === listing.id &&
      ['pending', 'accepted', 'counter', 'rejected'].includes(o.status),
  );
}
export const deadlineLabels = {
  open: '영입 경쟁 중',
  won: '우리 구단 영입',
  lost: '경쟁 구단 영입',
  cancelled: '매각 취소',
} as const;
