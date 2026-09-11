'use client';
import { useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';

export function useMatchCards(g: GameState, act: Act, busy: boolean) {
  const draft = g.liveMatch!.cards!;
  const [selected, setSelected] = useState<string[]>([]);
  const submitting = useRef(false);
  return {
    draft,
    selected,
    toggle: (id: string) => {
      if (busy || submitting.current) return;
      setSelected((previous) =>
        previous.includes(id)
          ? previous.filter((value) => value !== id)
          : previous.length < 3
            ? [...previous, id]
            : previous,
      );
    },
    confirm: async () => {
      if (busy || submitting.current || selected.length !== 3) return;
      submitting.current = true;
      try {
        await act({
          type: 'chooseMatchCards',
          draftId: draft.id,
          ids: selected,
          cursor: 0,
          timelineVersion: g.liveMatch!.timelineVersion,
        });
      } finally {
        submitting.current = false;
      }
    },
  };
}
