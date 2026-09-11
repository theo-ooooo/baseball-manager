'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { cardTargetEligible } from '@dugout/shared/tactic-cards';
import { useWorld } from './world-context';
export function useTacticCards(g: GameState) {
  const { clubs, getClub, rosterFor } = useWorld();
  const others = clubs.filter((c) => c.id !== g.club && c.league === getClub(g.club).league);
  const [club, setClub] = useState(others[0]?.id || ''),
    [selected, setSelected] = useState(''),
    [target, setTarget] = useState('');
  const card = g.tacticCards?.hand.find((c) => c.id === selected),
    players = card ? rosterFor(g, club).filter((p) => cardTargetEligible(card, p)) : [];
  return {
    club,
    setClub,
    selected,
    setSelected,
    target,
    setTarget,
    card,
    players,
    others,
    getClub,
  };
}
