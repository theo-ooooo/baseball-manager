'use client';
import { useMemo, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { previewSubstitution } from './preview-substitution';

export function usePreviewSubstitution(g: GameState, busy: boolean, canApply: boolean, act: Act) {
  const recommendation = useMemo(() => previewSubstitution(g), [g]);
  const [declined, setDeclined] = useState('');
  const submitting = useRef(false);
  const visible = recommendation?.id !== declined ? recommendation : undefined;
  return {
    recommendation: visible,
    dismiss: () => setDeclined(recommendation?.id || ''),
    apply: async () => {
      if (!visible || busy || !canApply || submitting.current) return;
      submitting.current = true;
      try {
        await act({
          type: 'reviseMatch',
          ...visible.plan,
          cursor: 0,
          timelineVersion: g.liveMatch!.timelineVersion,
        });
      } finally {
        submitting.current = false;
      }
    },
  };
}
