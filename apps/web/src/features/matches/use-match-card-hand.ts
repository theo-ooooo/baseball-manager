'use client';
import { useRef } from 'react';
import type { GameState } from '@dugout/shared/types';
import { selectedMatchCards } from '@dugout/shared/match-cards';
import { matchCardUseReason } from '@dugout/shared/match-card-decisions';
import type { Act } from '../career/game-contracts';
import { coachMatchCard } from './coach-match-card';

export function useMatchCardHand(
  g: GameState,
  cursor: number,
  busy: boolean,
  paused: boolean,
  act: Act,
) {
  const submitting = useRef(false);
  const live = g.liveMatch!,
    draft = live.cards!;
  const cards = selectedMatchCards(draft).map((card) => ({
    card,
    used:
      draft.used?.some((use) => use.cardId === card.id) ||
      live.timeline!.log.slice(0, cursor).some((event) => event.play?.cards?.own === card.id),
    reason: matchCardUseReason(live, g.club, cursor, card.id),
  }));
  return {
    cards,
    recommendation: paused ? coachMatchCard(g, cursor) : undefined,
    pending: cards.find(({ card }) =>
      draft.used?.some((use) => use.cursor === cursor && use.cardId === card.id),
    )?.card,
    use: async (cardId: string) => {
      if (busy || !paused || submitting.current || matchCardUseReason(live, g.club, cursor, cardId))
        return;
      submitting.current = true;
      try {
        await act({
          type: 'useMatchCard',
          draftId: draft.id,
          cardId,
          cursor,
          timelineVersion: live.timelineVersion,
        });
      } finally {
        submitting.current = false;
      }
    },
  };
}
