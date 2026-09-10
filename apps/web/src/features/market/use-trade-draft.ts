'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';
export function useTradeDraft(g: GameState, targetId?: string) {
  const { clubs, getClub, marketPlayers } = useWorld();
  const others = clubs.filter((c) => c.id !== g.club && c.league === getClub(g.club).league);
  const target = targetId
    ? marketPlayers(g).find((p) => p.id === targetId && others.some((c) => c.id === p.club))
    : undefined;
  const [club, setClub] = useState(target?.club || others[0]?.id || '');
  const [incoming, setIncoming] = useState<string[]>(target ? [target.id] : []);
  const [outgoing, setOutgoing] = useState<string[]>([]);
  const [cash, setCash] = useState('0');
  return { others, club, setClub, incoming, setIncoming, outgoing, setOutgoing, cash, setCash };
}
