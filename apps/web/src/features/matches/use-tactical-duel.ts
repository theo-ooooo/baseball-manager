'use client';
import { useState } from 'react';
import { tacticalDuel, type DefensivePlan } from '@dugout/shared/tactical-duel';
import { conversationKey } from '@dugout/shared/match-media';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
export function useTacticalDuel(g: GameState, act: Act, busy: boolean) {
  const world = useWorld(),
    pair = world.nextFixture(g);
  const [open, setOpen] = useState(false),
    [plan, setPlan] = useState<DefensivePlan>('balanced');
  const duel = pair ? tacticalDuel(g, pair[0], pair[1]) : undefined;
  const own = pair?.[0] === g.club ? duel?.home : duel?.away;
  return {
    open,
    setOpen,
    plan,
    setPlan,
    duel,
    pair,
    show() {
      if (own) {
        setPlan(own.plan);
        setOpen(true);
      }
    },
    async save() {
      if (busy || !pair || g.liveMatch) return;
      const next = await act({ type: 'setDefensivePlan', key: conversationKey(g, pair), plan });
      if (next) setOpen(false);
    },
  };
}
