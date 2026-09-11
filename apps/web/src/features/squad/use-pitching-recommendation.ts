'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { firstTeam } from '@dugout/shared/management';
import { recommendedPitching } from '@dugout/shared/pitching';
import type { Act } from '../career/game-contracts';
export function usePitchingRecommendation(g: GameState, act: Act, busy: boolean) {
  const [preview, setPreview] = useState(false);
  const plan = recommendedPitching(firstTeam(g));
  return {
    preview,
    setPreview,
    plan,
    apply: async () => {
      if (!busy && !g.liveMatch && (await act({ type: 'recommendPitching' }))) setPreview(false);
    },
  };
}
