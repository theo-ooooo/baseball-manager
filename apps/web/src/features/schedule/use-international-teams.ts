'use client';
import { useMemo, useState } from 'react';
import { gameDate } from '@dugout/shared/calendar';
import {
  internationalCalendar,
  internationalCountries,
  internationalRoster,
} from '@dugout/shared/international';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';

export function useInternationalTeams(g: GameState) {
  const world = useWorld();
  const [eventId, setEventId] = useState('');
  const [chosenCountry, setCountry] = useState('대한민국');
  const events = useMemo(
    () =>
      [
        ...new Map(
          [...(g.international?.events || []), ...internationalCalendar(g.year)].map((event) => [
            event.id,
            event,
          ]),
        ).values(),
      ].sort((a, b) => a.start.localeCompare(b.start)),
    [g.year, g.international],
  );
  const event =
    events.find((e) => e.id === eventId) ||
    events.find((e) => e.returnDate >= gameDate(g)) ||
    events.at(-1);
  const selection = g.international?.events.find((e) => e.id === event?.id);
  const countries = event?.kind === 'asian' ? ['대한민국', '대만', '중국'] : internationalCountries;
  const country = countries.includes(chosenCountry) ? chosenCountry : countries[0];
  const players = useMemo(
    () => internationalRoster(selection, country, [...g.roster, ...world.marketPlayers(g)]),
    [selection, country, g, world],
  );
  return {
    events,
    event,
    selection,
    countries,
    country,
    players,
    setEventId,
    setCountry,
    getClub: world.getClub,
  };
}
