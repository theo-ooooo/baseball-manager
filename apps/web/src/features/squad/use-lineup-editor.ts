'use client';
import { useState } from 'react';
import type { DefensivePosition, GameState } from '@dugout/shared/types';
import { firstTeam, defenseFor } from '@dugout/shared/management';
import { lineupAuto } from '@dugout/shared/game-view';
import type { Act } from '../career/game-contracts';

export function useBattingOrder(g: GameState) {
  const [lineup, setLineup] = useState([...g.lineup]);
  const active = firstTeam(g);
  const byId = new Map(active.map((p) => [p.id, p]));
  const batters = lineup.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  function changeBatter(index: number, id: string) {
    setLineup((current) => {
      const ids = [...current],
        old = ids.indexOf(id);
      if (old >= 0) [ids[index], ids[old]] = [ids[old], ids[index]];
      else ids[index] = id;
      return ids;
    });
  }
  return {
    lineup,
    active,
    batters,
    changeBatter,
    dirty: lineup.join(':') !== g.lineup.join(':'),
    recommend: () => setLineup(lineupAuto(active)),
    reset: () => setLineup([...g.lineup]),
  };
}

export function useDefensivePlacement(g: GameState, act?: Act, busy?: boolean) {
  const [selected, setSelected] = useState('');
  async function place(id: string, pos: DefensivePosition) {
    if (!act || busy) return;
    if (await act({ type: 'defense', id, position: pos })) setSelected('');
  }
  return {
    selected,
    setSelected,
    place,
    defense: defenseFor(g),
    chosen: g.roster.find((p) => p.id === selected),
  };
}

export function useLineupView() {
  const [lineupView, setLineupView] = useState('order');
  return { lineupView, setLineupView };
}
