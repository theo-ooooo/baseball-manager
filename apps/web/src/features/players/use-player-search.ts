'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';

export function usePlayerSearch(g: GameState) {
  const { marketPlayers, getClub } = useWorld();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase().replaceAll(' ', ''));
  const players = useMemo(() => [...g.roster, ...marketPlayers(g)], [g, marketPlayers]);
  const matches = useMemo(
    () =>
      deferred
        ? players.filter((p) =>
            `${p.name} ${p.original}`.toLocaleLowerCase().replaceAll(' ', '').includes(deferred),
          )
        : [],
    [players, deferred],
  );
  return {
    open,
    setOpen,
    query,
    setQuery,
    results: matches.slice(0, 30),
    count: matches.length,
    getClub,
  };
}
