'use client';
import { useMemo, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { coachSubstitution } from './coach-substitution';
import { requestMatchResume } from './use-match-resume';

export function useCoachSubstitution(
  g: GameState,
  cursor: number,
  busy: boolean,
  canApply: boolean,
  act: Act,
) {
  const recommendation = useMemo(() => coachSubstitution(g, cursor), [g, cursor]);
  const [declined, setDeclined] = useState('');
  const submitting = useRef(false);
  const visible = recommendation?.id !== declined ? recommendation : undefined;
  return {
    recommendation: visible,
    dismiss: () => setDeclined(recommendation?.id || ''),
    apply: async () => {
      if (!visible || busy || !canApply || submitting.current) return;
      submitting.current = true;
      const live = g.liveMatch!,
        cancelResume = requestMatchResume(live);
      try {
        const next = await act({
          type: 'reviseMatch',
          ...visible.plan,
          emergency: visible.emergency,
          cursor,
          timelineVersion: live.timelineVersion,
        });
        if (!next) cancelResume();
      } catch (error) {
        cancelResume();
        throw error;
      } finally {
        submitting.current = false;
      }
    },
    warm: async () => {
      if (!visible?.canWarm || busy || !canApply || submitting.current) return;
      submitting.current = true;
      try {
        await act({
          type: 'bullpen',
          id: visible.incoming.id,
          mode: 'warm',
          cursor,
          timelineVersion: g.liveMatch!.timelineVersion,
        });
      } finally {
        submitting.current = false;
      }
    },
  };
}
