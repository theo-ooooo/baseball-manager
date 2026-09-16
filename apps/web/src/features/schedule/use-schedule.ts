import { useState } from 'react';
import type { Fixture, GameState } from '@dugout/shared/types';
import { addDays, daysBetween, gameDate } from '@dugout/shared/calendar';
import { preseasonFixtures } from '@dugout/shared/management';
import { postseasonFixtures, type PostseasonFixture } from '@dugout/shared/postseason';
import { useWorld } from '../career/world-context';
import { clubResults } from '@dugout/shared/club-results';

export function useSchedule(g: GameState) {
  const { clubs, getClub, fixtures, scheduleNote } = useWorld();
  const lid = getClub(g.club).league,
    today = gameDate(g),
    anchor = today.slice(0, 7);
  const [scope, setScope] = useState('league');
  const [selection, setSelection] = useState({ anchor, month: anchor });
  const month = selection.anchor === anchor ? selection.month : anchor;
  const setMonth = (month: string) => setSelection({ anchor, month });
  const first = month + '-01',
    last = addDays(month + '-28', 4);
  const count = daysBetween(first, last.slice(0, 7) + '-01');
  const visible = (fixture: Fixture) =>
    scope === 'league' || fixture.home === g.club || fixture.away === g.club;
  const list: (Fixture | PostseasonFixture)[] = [
    ...fixtures(g, lid),
    ...postseasonFixtures(g, lid),
  ];
  const monthFixtures = list.filter((f) => f.date.startsWith(month) && visible(f));
  const byDate = new Map<string, (Fixture | PostseasonFixture)[]>();
  for (const fixture of monthFixtures)
    byDate.set(fixture.date, [...(byDate.get(fixture.date) || []), fixture]);
  const cancellations = Object.values(g.weather?.postponed || {})
    .filter((entry) => entry.fixture.league === lid && visible(entry.fixture))
    .flatMap((entry) =>
      entry.cancellations.map((cancel) => ({ ...cancel, fixture: entry.fixture })),
    )
    .filter((cancel) => cancel.date.startsWith(month));
  const scores = new Map(
    [...(g.worldResults || []), ...g.history]
      .filter((r) => r.fixtureId)
      .map((r) => [r.fixtureId!, r]),
  );
  const friendlies = g.rules?.preseason ? preseasonFixtures(g, { clubs }) : [];
  return {
    clubResults: clubResults(g),
    scope,
    setScope,
    month,
    setMonth,
    today,
    scheduleNote: scheduleNote(g),
    scores,
    count: monthFixtures.filter((f) => !('post' in f) || f.status !== 'cancelled').length,
    changeMonth: (n: number) => {
      const date = new Date(month + '-15T12:00:00Z');
      date.setUTCMonth(date.getUTCMonth() + n);
      setMonth(date.toISOString().slice(0, 7));
    },
    days: Array.from({ length: count }, (_, i) => {
      const date = addDays(first, i),
        day = daysBetween(gameDate(g, 0), date);
      return {
        date,
        day,
        fixtures: byDate.get(date) || [],
        cancellations: cancellations.filter((cancel) => cancel.date === date),
        friendly: friendlies.find((f) => f.day === day),
      };
    }),
  };
}
