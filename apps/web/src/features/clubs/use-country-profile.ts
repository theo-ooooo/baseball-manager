'use client';
import { useMemo, useState } from 'react';
import { gameCountries, leagueCountries } from '@dugout/shared/countries';
import { nationalCountry } from '@dugout/shared/international';
import { visibleOverall } from '@dugout/shared/player-profile-view';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';
import { useInternationalTeams } from '../schedule/use-international-teams';
export function useCountryProfile(g: GameState, country: string) {
  const world = useWorld(),
    [tab, setTab] = useState('overview');
  const teams = useInternationalTeams(g, country);
  const domestic = world.leagues.filter((l) => leagueCountries(l).includes(country));
  const clubs = world.clubs.filter((c) => domestic.some((l) => l.id === c.league));
  const pool = useMemo(
    () => [...g.roster, ...world.marketPlayers(g)].filter((p) => nationalCountry(p) === country),
    [g, world, country],
  );
  const notable = useMemo(
    () =>
      [...pool]
        .sort(
          (a, b) =>
            (visibleOverall(b) ?? -1) - (visibleOverall(a) ?? -1) || a.name.localeCompare(b.name),
        )
        .slice(0, 4),
    [pool],
  );
  const averageAge = teams.players.length
    ? teams.players.reduce((sum, p) => sum + p.age, 0) / teams.players.length
    : undefined;
  return {
    tab,
    setTab,
    teams,
    domestic,
    clubs,
    pool,
    notable,
    averageAge,
    known: gameCountries(world.leagues).includes(country),
    getClub: world.getClub,
    standings: world.standings,
    region:
      domestic[0]?.region ||
      (['대한민국', '일본', '대만', '중국'].includes(country) ? '아시아' : undefined),
  };
}
