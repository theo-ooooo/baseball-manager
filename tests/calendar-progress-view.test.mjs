import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['apps/web/src/features/career/calendar-progress-view.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { visibleCalendarJourney, calendarDayResults } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const game = {
  year: 2026,
  club: 'kbo-kia',
  day: 6,
  phase: 'regular',
  calendar: { openingDate: '2026-03-28', startDay: 0 },
  history: [],
};
const journey = {
  year: 2026,
  club: 'kbo-kia',
  day: 6,
  start: 5,
  phase: 'regular',
  limit: 45,
  status: '경기일에 도착했습니다',
  running: false,
};
test('Completed calendar notices disappear after a match, round, club or season changes, while active day progression remains visible', () => {
  assert.equal(visibleCalendarJourney(journey, game), journey);
  for (const change of [{ day: 8 }, { year: 2027 }, { phase: 'wildcard' }, { club: 'kbo-lg' }])
    assert.equal(visibleCalendarJourney(journey, { ...game, ...change }), null);
  const running = { ...journey, running: true };
  assert.equal(visibleCalendarJourney(running, { ...game, day: 7 }), running);
  assert.equal(visibleCalendarJourney(running, { ...game, year: 2027 }), null);
});
test('Past calendar dates show actual club results, including doubleheaders, and exclude another club or season', () => {
  const first = {
    date: '2026-03-31',
    day: 3,
    home: 'kbo-kia',
    away: 'kbo-lg',
    homeScore: 3,
    awayScore: 2,
  };
  const second = { ...first, homeScore: 1, awayScore: 4 };
  const g = {
    ...game,
    history: [first, second, { ...first, date: '2025-03-31' }, { ...first, home: 'kbo-lotte' }],
  };
  assert.deepEqual(calendarDayResults(g, 3), [first, second]);
  assert.deepEqual(calendarDayResults(g, 2), []);
});
