'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import { availableRemodels, remodelUsed, type RemodelKind } from '@dugout/shared/player-remodel';
import type { Act } from '../career/game-contracts';
export function usePlayerRemodel(g: GameState, p: Player, act: Act, busy: boolean) {
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState<RemodelKind>();
  const active = p.remodel?.status === 'training';
  const locked =
    busy ||
    !!g.liveMatch ||
    g.managerCareer?.status === 'unemployed' ||
    !!g.managerCareer?.vacationUntil;
  const used = remodelUsed(g, p);
  const plans = availableRemodels(p);
  const submit = async () => {
    if (!kind || locked) return;
    if (await act({ type: 'startRemodel', id: p.id, kind })) {
      setOpen(false);
      setKind(undefined);
    }
  };
  const cancel = async () => {
    if (!locked) await act({ type: 'cancelRemodel', id: p.id });
  };
  return { open, setOpen, kind, setKind, active, locked, used, plans, submit, cancel };
}
