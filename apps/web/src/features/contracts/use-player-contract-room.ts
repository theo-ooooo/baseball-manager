'use client';
import { useState } from 'react';
import type { Deal, GameState, Player } from '@dugout/shared/types';
import { playerContractContext } from '@dugout/shared/contract-status';
import { useWorld } from '../career/world-context';
export function usePlayerContractRoom(g: GameState, requested: Player) {
  const { marketPlayers } = useWorld();
  const current =
    g.roster.find((p) => p.id === requested.id) ||
    marketPlayers(g).find((p) => p.id === requested.id);
  const context = playerContractContext(g, current);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [signing, setSigning] = useState<Deal | null>(null);
  return { ...context, player: current || requested, editingId, setEditingId, signing, setSigning };
}
