'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { clubMemories, MAX_CLUB_MOMENTS } from '@dugout/shared/club-legacy';
import type { Act } from '../career/game-contracts';
export function useClubLegacy(g: GameState, club: string, act: Act, busy: boolean) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(''),
    [caption, setCaption] = useState('');
  const memories = clubMemories(g, club),
    own = g.club === club && g.managerCareer?.status !== 'unemployed';
  const locked = busy || !!g.liveMatch || !!g.managerCareer?.vacationUntil || !own;
  const choices = g.history.filter((r) => !r.friendly && (r.home === club || r.away === club));
  const save = async () => {
    if (locked || !selected) return;
    if (await act({ type: 'pinClubMoment', id: selected, caption })) {
      setOpen(false);
      setSelected('');
      setCaption('');
    }
  };
  const remove = async (id: string) => {
    if (!locked) await act({ type: 'removeClubMoment', id });
  };
  const full = memories.moments.length >= MAX_CLUB_MOMENTS;
  return {
    ...memories,
    own,
    locked,
    choices,
    full,
    open,
    setOpen,
    selected,
    setSelected,
    caption,
    setCaption,
    save,
    remove,
  };
}
