'use client';
import { useRecords } from './career-records';
import { useDeferredValue, useMemo, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { coachDirectory } from '@dugout/shared/coach-directory';
import { managerDirectory, managerPersonPath } from '@dugout/shared/manager-directory';
import { useRouter } from 'next/navigation';
import { countryPath, gameCountries, searchCountries } from '@dugout/shared/countries';
import { useWorld } from '../career/world-context';

export function usePlayerSearch(g: GameState) {
  const { marketPlayers, getClub, leagues, coachPool } = useWorld();
  const router = useRouter();
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
  const countries = useMemo(
    () => searchCountries(deferred, gameCountries(leagues)),
    [deferred, leagues],
  );
  const managers = useMemo(
    () =>
      deferred && open
        ? managerDirectory(g).filter((p) =>
            p.name.toLocaleLowerCase().replace(/\s/g, '').includes(deferred),
          )
        : [],
    [g, deferred, open],
  );
  const coaches = useMemo(
    () =>
      deferred && open
        ? coachDirectory(g, coachPool(g.year)).filter(
            ({ coach }) =>
              !coach.managerPersonId &&
              coach.name.toLocaleLowerCase().replace(/\s/g, '').includes(deferred),
          )
        : [],
    [g, coachPool, deferred, open],
  );
  const retired = useRecords(
    open && deferred ? `/api/records/retired?query=${encodeURIComponent(deferred)}` : null,
  );
  return {
    retired: retired.data || [],
    retiredError: retired.error,
    openRetired(id: string) {
      setOpen(false);
      router.push(`/players/${encodeURIComponent(id)}`);
    },
    managers: managers.slice(0, 20),
    coaches: coaches.slice(0, 20),
    managerCount: managers.length,
    coachCount: coaches.length,
    openManager(id: string) {
      setOpen(false);
      router.push(managerPersonPath(id));
    },
    openCoach(id: string) {
      setOpen(false);
      router.push(`/coaches/${encodeURIComponent(id)}`);
    },
    countries,
    openCountry(country: string) {
      setOpen(false);
      router.push(countryPath(country));
    },
    open,
    setOpen,
    query,
    setQuery,
    results: matches.slice(0, 30),
    count: matches.length,
    getClub,
  };
}
