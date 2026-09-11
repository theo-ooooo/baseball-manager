'use client';
import type { GameState } from '@dugout/shared/types';
import { nationalReplacement } from '@dugout/shared/international-replacement';
import type { Act } from '../career/game-contracts';
import { isUnemployed } from '@dugout/shared/manager-career';

export function useInternationalDuty(g: GameState, act: Act, busy: boolean, eventId?: string) {
  const rows = (g.international?.events || [])
    .filter((e) => (eventId ? e.id === eventId : e.stage !== 'returned'))
    .flatMap((event) =>
      g.roster
        .filter((p) => event.players.includes(p.id))
        .map((player) => ({
          event,
          player,
          replacement: nationalReplacement(g, player.id),
        })),
    );
  return {
    rows: isUnemployed(g) ? [] : rows,
    disabled: busy || !!g.liveMatch || isUnemployed(g),
    replace: (id: string, replacementId: string) =>
      act({ type: 'internationalReplacement', id, replacementId }),
  };
}
