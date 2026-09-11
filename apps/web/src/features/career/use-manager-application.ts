'use client';
import { useState } from 'react';
import { isUnemployed } from '@dugout/shared/manager-career';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';
export function useManagerApplication(
  g: GameState,
  clubId: string,
  act: Act,
  busy: boolean,
  close: () => void,
) {
  const { clubs, getClub } = useWorld(),
    club = getClub(clubId),
    employed = !isUnemployed(g);
  const count = clubs.filter((c) => c.league === club.league).length;
  const [channel, setChannel] = useState<'private' | 'public'>('private'),
    [target, setTarget] = useState(
      g.managerJobs?.[clubId]?.expectation?.targetRank ?? Math.ceil(count / 2),
    );
  async function submit() {
    if (busy) return;
    if (
      await act({
        type: 'applyManager',
        club: clubId,
        targetRank: target,
        public: channel === 'public',
      })
    )
      close();
  }
  return { club, employed, count, channel, setChannel, target, setTarget, submit };
}
