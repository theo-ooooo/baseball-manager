'use client';
import { useMemo, useState } from 'react';
import { participatesInTournament } from '@dugout/shared/countries';
import { gameDate } from '@dugout/shared/calendar';
import {
  internationalCalendar,
  internationalCountries,
  internationalRoster,
} from '@dugout/shared/international';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';

export function useInternationalTeams(g: GameState, fixedCountry?: string) {
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
      ]
        .filter((event) => !fixedCountry || participatesInTournament(fixedCountry, event.kind))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [g.year, g.international, fixedCountry],
  );
  const event =
    events.find((e) => e.id === eventId) ||
    events.find(
      (e) => e.returnDate >= gameDate(g) && g.international?.events.some((s) => s.id === e.id),
    ) ||
    events.filter((e) => g.international?.events.some((s) => s.id === e.id)).at(-1) ||
    events.find((e) => e.returnDate >= gameDate(g)) ||
    events.at(-1);
  const selection = g.international?.events.find((e) => e.id === event?.id);
  const countries = event?.kind === 'asian' ? ['대한민국', '대만', '중국'] : internationalCountries;
  const country =
    fixedCountry || (countries.includes(chosenCountry) ? chosenCountry : countries[0]);
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
