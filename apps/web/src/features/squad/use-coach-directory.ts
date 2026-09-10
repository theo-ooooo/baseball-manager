'use client';
import { useMemo, useState } from 'react';
import type { Coach, GameState } from '@dugout/shared/types';
import { coachDirectory } from '@dugout/shared/coach-directory';
import { useWorld } from '../career/world-context';

export function useCoachDirectory(g: GameState) {
  const { coachPool, getClub } = useWorld();
  const [group, setGroup] = useState('own');
  const [role, setRole] = useState('타격');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const [offering, setOffering] = useState<Coach | null>(null);
  const directory = useMemo(() => coachDirectory(g, coachPool(g.year)), [g, coachPool]);
  const groupOf = (club: string) => (club === g.club ? 'own' : club === 'fa' ? 'free' : 'other');
  const counts = Object.fromEntries(
    ['own', 'other', 'free'].map((key) => [
      key,
      directory.filter((entry) => groupOf(entry.club) === key).length,
    ]),
  );
  const candidates = directory.filter(
    ({ coach: c, club }) =>
      groupOf(club) === group &&
      (kind === 'all' || (kind === 'real' ? c.real : !c.real)) &&
      `${c.name} ${getClub(club)?.name || ''} ${c.role}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(candidates.length / 12));
  const current = Math.min(page, pages - 1);
  return {
    group,
    role,
    query,
    kind,
    offering,
    counts,
    pages,
    current,
    count: candidates.length,
    rows: candidates.slice(current * 12, current * 12 + 12),
    setOffering,
    setPage,
    setRole,
    setGroup: (value: string) => {
      setGroup(value);
      setPage(0);
    },
    setQuery: (value: string) => {
      setQuery(value);
      setPage(0);
    },
    setKind: (value: string) => {
      setKind(value);
      setPage(0);
    },
    clubName: (club: string) => (club === 'fa' ? '무소속' : getClub(club)?.name || club),
  };
}
