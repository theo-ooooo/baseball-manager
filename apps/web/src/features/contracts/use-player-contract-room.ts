'use client';
import { useState } from 'react';
import type { Deal, GameState, Player } from '@dugout/shared/types';
import { playerContractContext, contractSignedThisYear } from '@dugout/shared/contract-status';
import type { Act } from '../career/game-contracts';
import { toast } from 'sonner';
import { useWorld } from '../career/world-context';
export function usePlayerContractRoom(
  g: GameState,
  requested: Player,
  act: Act,
  close?: () => void,
) {
  const { marketPlayers } = useWorld();
  const current =
    g.roster.find((p) => p.id === requested.id) ||
    marketPlayers(g).find((p) => p.id === requested.id);
  const context = playerContractContext(g, current);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [signing, setSigning] = useState<Deal | null>(null);
  const completed = context.own && !!current && contractSignedThisYear(g, current);
  async function sign() {
    if (!signing) return false;
    const next = await act({ type: 'sign', id: signing.id });
    if (!next) return false;
    setSigning(null);
    setEditingId(null);
    close?.();
    toast.success('계약을 체결했습니다. 새 계약 조건을 저장했습니다.');
    return true;
  }
  return {
    ...context,
    player: current || requested,
    editingId,
    setEditingId,
    signing,
    setSigning,
    completed,
    sign,
  };
}
