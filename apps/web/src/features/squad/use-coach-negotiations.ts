'use client';
import { useState } from 'react';
import type { CoachDeal, GameState } from '@dugout/shared/types';
export function useCoachNegotiations(g: GameState) {
  const [signingId, setSigningId] = useState<string | null>(null);
  const deals = (g.coachDeals || []).filter(
    (d) =>
      ['pending', 'counter', 'accepted'].includes(d.status) &&
      (d.year === undefined || d.year === g.year) &&
      g.day <= (d.expires ?? d.day + 14),
  );
  return {
    deals,
    signing: deals.find((d) => d.id === signingId && d.status === 'accepted') || null,
    setSigning: (deal: CoachDeal | null) => setSigningId(deal?.id || null),
  };
}
