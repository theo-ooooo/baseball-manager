'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { draftWindow } from '@dugout/shared/draft-rules';
import { useWorld } from '../career/world-context';
import { overall } from '@dugout/shared/game-view';
export function useRookieDraft(g: GameState) {
  const [query, setQuery] = useState(''),
    [position, setPosition] = useState('all'),
    [selected, setSelected] = useState('');
  const { draftRules, getClub } = useWorld();
  const window = draftWindow(g, getClub(g.club).league, { draftRules });
  const d = g.draft;
  const players = [...(d?.prospects || [])]
    .filter((p) => (position === 'all' || p.pos === position) && p.name.includes(query.trim()))
    .sort((a, b) => overall(b) - overall(a) || a.name.localeCompare(b.name));
  return {
    query,
    setQuery,
    position,
    setPosition,
    selected,
    setSelected,
    players,
    candidate: d?.prospects.find((p) => p.id === selected),
    window,
    canStart: window.open,
  };
}
