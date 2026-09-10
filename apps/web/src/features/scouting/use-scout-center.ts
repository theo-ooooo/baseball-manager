'use client';
import { useMemo, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { scoutingCost } from '@dugout/shared/scouting';
import { useWorld } from '../career/world-context';
export function useScoutCenter(g: GameState, act: Act, initialTab?: string) {
  const { getClub, marketPlayers } = useWorld();
  const [tab, setTab] = useState(
      initialTab && ['reports', 'missions', 'shortlist'].includes(initialTab)
        ? initialTab
        : g.scouting?.reports.length
          ? 'reports'
          : 'missions',
    ),
    [league, setLeague] = useState(getClub(g.club).league),
    [pos, setPos] = useState('all'),
    [maxAge, setMaxAge] = useState(25),
    [days, setDays] = useState(14),
    [selected, setSelected] = useState<string[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const market = useMemo(() => new Map(marketPlayers(g).map((p) => [p.id, p])), [g, marketPlayers]);
  const s = g.scouting,
    active = s?.assignments.filter((t) => t.status === 'active') || [],
    scout = g.staff.find((c) => c.role === '스카우트');
  const reports = s?.reports || [],
    cost = scoutingCost(days, true);
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 3 ? [...ids, id] : ids,
    );
  async function dispatch() {
    const next = await act({ type: 'assignScout', league, pos, maxAge, days, scoutId: scout?.id });
    if (next) {
      setAssignmentOpen(false);
      setTab('missions');
    }
  }
  return {
    dispatch,
    assignmentOpen,
    setAssignmentOpen,
    tab,
    setTab,
    league,
    setLeague,
    pos,
    setPos,
    maxAge,
    setMaxAge,
    days,
    setDays,
    selected,
    market,
    active,
    scout,
    reports,
    cost,
    toggle,
  };
}
