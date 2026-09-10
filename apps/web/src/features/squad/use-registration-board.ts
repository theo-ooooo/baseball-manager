'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { gameDate, addDays } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';
export function useRegistrationBoard(g: GameState) {
  const world = useWorld(),
    today = gameDate(g),
    league = world.getClub(g.club).league;
  const [period, setPeriod] = useState('today'),
    [club, setClub] = useState('all'),
    [query, setQuery] = useState('');
  const clubs = world.clubs.filter((c) => c.league === league),
    ids = new Set(clubs.map((c) => c.id));
  const since = addDays(today, period === 'today' ? 0 : period === 'yesterday' ? -1 : -7);
  const events = (g.registrations?.events || []).filter(
    (e) =>
      ids.has(e.club) &&
      (club === 'all' || e.club === club) &&
      e.date >= since &&
      e.date <= (period === 'yesterday' ? since : today) &&
      e.name.includes(query),
  );
  return { ...world, today, period, setPeriod, club, setClub, query, setQuery, clubs, events };
}
