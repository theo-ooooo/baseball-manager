'use client';
import { useState } from 'react';
export function useWorldPanel(initialLeague: string) {
  const [league, setLeague] = useState(initialLeague);
  const [team, setTeam] = useState('');
  const [tab, setTab] = useState<'standings' | 'players' | 'clubs'>('standings');
  return {
    league,
    team,
    tab,
    setTeam,
    setTab,
    selectLeague(id: string) {
      setLeague(id);
      setTeam('');
    },
  };
}
