'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { CareerChallenge } from '@dugout/shared/career-engagement';
import type { Act } from './game-contracts';
import { useWorld } from './world-context';
import { currentCareerSlot, switchCareerSlot } from './career-slot';
export function useChallengeCareer(
  g: GameState | null,
  act: Act,
  busy: boolean,
  onStarted?: () => Promise<void>,
  autoOpen = false,
) {
  const { clubs } = useWorld();
  const [open, setOpen] = useState(autoOpen),
    [kind, setKind] = useState<CareerChallenge['kind']>('chase'),
    [club, setClub] = useState('kbo-kia'),
    [manager, setManager] = useState(g?.manager || '도전 감독');
  const kbo = clubs.filter((c) => c.league === 'kbo');
  const weakest = kbo.find((c) => c.id === 'kbo-kiwoom')!;
  return {
    open,
    setOpen,
    kind,
    setKind,
    club,
    setClub,
    manager,
    setManager,
    kbo,
    weakest,
    slot: currentCareerSlot(),
    switchSlot: switchCareerSlot,
    async start() {
      if (busy) return;
      const next = await act({
        type: 'start',
        club: kind === 'rebuild' ? weakest.id : club,
        manager,
        mode: 'short',
        preseason: false,
        challenge: kind,
        replace: !!g,
      });
      if (next) {
        setOpen(false);
        await onStarted?.();
      }
    },
  };
}
