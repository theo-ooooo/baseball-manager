import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-calendar-test.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { world: w, engine: e, createCalendarView } = createRequire(import.meta.url)(out);
test('Official calendar has the correct club totals, rest dates and distinct fixture identities', () => {
  for (const [lid, games] of [
    ['kbo', 144],
    ['mlb', 162],
    ['npb', 143],
  ]) {
    const fs = w.fixtures.filter((f) => f.league === lid);
    assert.equal(new Set(fs.map((f) => f.id)).size, fs.length);
    for (const c of w.clubs.filter((c) => c.league === lid))
      assert.equal(fs.filter((f) => f.home === c.id || f.away === c.id).length, games, c.id);
  }
  const g = e.newGame('kbo-lotte', 'Calendar', 'full', 3);
  assert.equal(e.nextFixture({ ...g, phase: 'regular', day: 0 })[0], 'kbo-samsung');
  assert.equal(e.onDate(g, 'kbo', 2).length, 0);
  assert.equal(e.ownFixtures(g, 3)[0].away, 'kbo-lotte');
});
test('Generated calendars satisfy every club game count, including odd-team leagues', () => {
  for (const l of w.leagues) {
    const g = e.newGame(w.clubs.find((c) => c.league === l.id).id, 'Future', 'full', 3);
    g.year = 2027;
    g.calendar = undefined;
    const fs = e.fixtures(g, l.id);
    for (const c of w.clubs.filter((c) => c.league === l.id))
      assert.equal(fs.filter((f) => f.home === c.id || f.away === c.id).length, l.games, c.id);
  }
});
test('Rest day advances the date without creating a match; league games share the same date', () => {
  let g = e.newGame('kbo-lotte', 'Calendar', 'full', 3);
  while (g.phase === 'preseason') g = e.advance(g, 7);
  g = e.advance(g, 2);
  const count = g.history.length,
    budget = g.budget,
    income = g.income,
    expenses = g.expenses;
  g = e.advance(g, 1);
  assert.equal(g.history.length, count);
  assert.equal(g.day, 3);
  assert.ok(g.expenses > expenses);
  assert.ok(g.income > income);
  assert.ok(Math.abs(g.budget - budget - (g.income - income - (g.expenses - expenses))) < 1e-8);
  assert.equal(
    g.worldResults.filter((r) => r.date === '2026-03-28' && r.home.startsWith('kbo-')).length,
    5,
  );
});

test('Shared schedules reuse date indexes across requests without exposing mutable career state', () => {
  const g = e.newGame('kbo-lotte', 'Schedule cache', 'short', 3);
  g.day = 0;
  const a = createCalendarView(w),
    b = createCalendarView(w);
  const original = a.onDate(g, 'kbo');
  const other = structuredClone(g);
  other.club = 'kbo-lg';
  other.manager = 'Another career';
  assert.strictEqual(b.onDate(other, 'kbo'), original);
  assert.equal(original.length, 5);
  const snapshot = JSON.stringify(original);
  assert.throws(() => {
    original[0].home = 'fa';
  }, TypeError);
  assert.throws(() => {
    original.pop();
  }, TypeError);
  assert.equal(JSON.stringify(b.onDate(other, 'kbo')), snapshot);
  assert.ok(a.ownFixtures(g).every((f) => [f.home, f.away].includes(g.club)));
  assert.ok(b.ownFixtures(other).every((f) => [f.home, f.away].includes(other.club)));
});

test('Different remaining schedules and catalog identities never share another career fixtures', () => {
  const g = e.newGame('kbo-lotte', 'Schedule isolation', 'short', 3);
  const a = createCalendarView(w);
  const original = a.fixtures(g, 'kbo');
  const legacy = structuredClone(g);
  legacy.calendar.remaining = Object.fromEntries(w.clubs.map((c) => [c.id, 2]));
  legacy.calendar.startDay = 20;
  const tail = createCalendarView(w).fixtures(legacy, 'kbo');
  assert.notDeepEqual(tail, original);
  assert.strictEqual(createCalendarView(w).fixtures(g, 'kbo'), original);
  const catalog = {
    ...w,
    clubs: w.clubs.map((c) => (c.league === 'kbo' ? { ...c, id: c.id + '-new' } : c)),
  };
  const replaced = createCalendarView(catalog).fixtures(g, 'kbo');
  assert.ok(replaced.every((f) => f.home.endsWith('-new') && f.away.endsWith('-new')));
  // Eviction does not affect deterministic calendars still held by another caller.
  for (let year = 2030; year < 2070; year++) a.fixtures({ ...g, year }, 'kbo');
  assert.deepEqual(a.fixtures(g, 'kbo'), original);
});
