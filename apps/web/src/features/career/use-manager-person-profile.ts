'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { coachDirectory } from '@dugout/shared/coach-directory';
import { managerCoachingStance } from '@dugout/shared/personality';
import { managerDirectory } from '@dugout/shared/manager-directory';
import { useWorld } from './world-context';
export function useManagerPersonProfile(g: GameState, id: string) {
  const [tab, setTab] = useState('overview');
  const [offering, setOffering] = useState(false);
  const { getClub, standings, coachPool } = useWorld();
  const person = managerDirectory(g).find((p) => p.id === id || p.record?.aliases?.includes(id));
  const job = person?.job,
    club = person?.club;
  const table = club ? standings(g, getClub(club).league) : [];
  const row = table.find((r) => r.club === club);
  const wins = row && job ? Math.max(0, row.w - job.startWins) : 0;
  const losses = row && job ? Math.max(0, row.l - job.startLosses) : 0;
  return {
    tab,
    setTab,
    offering,
    setOffering,
    coach: person?.record
      ? coachDirectory(g, coachPool(g.year)).find((e) => e.coach.id === person.id)?.coach
      : undefined,
    stance: person?.record ? managerCoachingStance(person.record) : undefined,
    person,
    getClub,
    wins,
    losses,
    rank:
      row && row.w + row.l + row.d > 0 ? table.findIndex((r) => r.club === club) + 1 : undefined,
    contract: person?.self ? g.managerCareer?.contract : undefined,
    reputation: person?.self
      ? (g.managerCareer?.reputation ?? g.reputation)
      : person?.record?.reputation,
  };
}
