'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { GameState, Player } from '@dugout/shared/types';
import { releaseCompensation, releaseError } from '@dugout/shared/player-release';
import type { Act } from '../career/game-contracts';

export function usePlayerRelease(g: GameState, player: Player, act: Act, busy: boolean) {
  const [open, setOpen] = useState(false);
  const cost = releaseCompensation(g, player),
    error = releaseError(g, player);
  const confirm = async () => {
    if (busy || error) return;
    if (await act({ type: 'releasePlayer', id: player.id, confirm: true, compensation: cost })) {
      setOpen(false);
      toast.success(`${player.name} 선수를 방출했습니다.`);
    }
  };
  return { open, setOpen, cost, error, confirm };
}
