import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-postseason-weather.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';export * from './packages/shared/src/match-weather';export * from './packages/shared/src/postseason';export * from './apps/api/src/domain/postseason-calendar';export * from './apps/api/src/domain/weather-scheduling';export * from './apps/api/src/domain/game-engine';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  world,
  createGameEngine,
  gameDate,
  addDays,
  preparePostseason,
  postseasonFixtures,
  matchWeather,
  postponeForWeather,
  canPlayWeather,
} = createRequire(import.meta.url)(out);
const club = (id) => world.clubs.find((c) => c.id === id);
function game() {
  return e.newGame('kbo-kia', 'Postseason QA', 'short', 45, { preseason: false });
}
function bracket() {
  const g = game();
  g.day = g.rounds;
  g.phase = 'semifinal';
  g.news = [];
  g.series = [
    { a: g.club, b: 'kbo-lg', aw: 0, bw: 0 },
    { a: 'kbo-ssg', b: 'kbo-doosan', aw: 0, bw: 0 },
  ];
  g.postseason = { year: g.year, league: 'kbo', format: 'four-team', rounds: [] };
  preparePostseason(g, 'kbo');
  return g;
}
function seedFor(g, predicate) {
  for (let seed = 0; seed < 100000; seed++) {
    g.weather.seed = seed;
    if (predicate()) return seed;
  }
  throw Error('weather seed not found');
}
function calm(g) {
  seedFor(g, () =>
    postseasonFixtures(g).every((f) => !matchWeather(g, f, club(f.home)).cancellation),
  );
}

test('Postseason creates dated games and preserves stable identities through saving', () => {
  const g = bracket(),
    before = structuredClone(g.series);
  assert.equal(postseasonFixtures(g).length, 6);
  assert.equal(
    e.nextFixture(g)?.length ?? 0,
    canPlayWeather(g, postseasonFixtures(g)[0], club(g.club)) ? 2 : 0,
  );
  assert.deepEqual(
    postseasonFixtures(g)
      .slice(0, 3)
      .map((f) => f.status),
    ['scheduled', 'scheduled', 'conditional'],
  );
  const restored = JSON.parse(JSON.stringify(g));
  preparePostseason(restored, 'kbo');
  assert.deepEqual(restored.postseason, g.postseason);
  assert.deepEqual(restored.series, before);
  assert.equal(new Set(postseasonFixtures(g).map((f) => f.id)).size, 6);
});

test('Legacy playoff scores are retained and only unplayed games receive new dates', () => {
  const g = bracket();
  delete g.postseason;
  g.series[0].aw = 1;
  g.series[1].bw = 2;
  const before = {
    seed: g.seed,
    history: structuredClone(g.history),
    scores: structuredClone(g.series),
  };
  preparePostseason(g, 'kbo');
  const fs = postseasonFixtures(g);
  assert.equal(fs.length, 2);
  assert.equal(fs[0].game, 2);
  assert.equal(fs[0].date, gameDate(g));
  assert.deepEqual(g.series, before.scores);
  assert.equal(g.seed, before.seed);
  assert.deepEqual(g.history, before.history);
});

test('Played playoff games link both brackets and the calendar without adding regular-season wins', () => {
  const g = bracket();
  calm(g);
  const regular = structuredClone(g.standings.kbo);
  e.advance(g, 1);
  const games = postseasonFixtures(g).filter((f) => f.status === 'completed');
  assert.equal(games.length, 2);
  assert.ok(games.every((f) => f.score));
  assert.deepEqual(g.standings.kbo, regular);
  assert.equal(g.history.length, 1);
  assert.ok(g.history[0].post);
  assert.ok(g.history[0].weather);
  assert.ok(games.some((f) => f.id === g.history[0].fixtureId));
  assert.equal(g.worldResults.filter((r) => r.post).length, 2);
});

test('Early series wins cancel unnecessary games and create a final after both semifinals', () => {
  const g = bracket();
  calm(g);
  g.series = g.series.map((s) => ({ ...s, aw: 1 }));
  delete g.postseason;
  preparePostseason(g, 'kbo');
  let n = 0;
  while (g.phase === 'semifinal' && n++ < 12) e.advance(g, 1);
  assert.equal(g.phase, 'final');
  assert.equal(g.postseason.rounds.length, 2);
  const semi = g.postseason.rounds[0],
    final = g.postseason.rounds[1];
  assert.ok(semi.series.every((s) => Math.max(s.aw, s.bw) === 2));
  assert.equal(final.fixtures.length, 5);
  assert.equal(final.fixtures[0].date, gameDate(g));
  assert.ok(semi.fixtures.filter((f) => f.status === 'cancelled').every((f) => !f.score));
  calm(g);
  while (g.phase !== 'finished' && n++ < 30) e.advance(g, 1);
  assert.equal(g.phase, 'finished');
  assert.ok(g.champion);
  assert.ok(postseasonFixtures(g).some((f) => f.status === 'completed'));
  g.managerCareer.offers = [];
  e.nextSeason(g);
  assert.equal(g.postseason, undefined);
  assert.deepEqual(g.weather.postponed, {});
  assert.equal(g.weather.year, g.year);
});

test('Generated weather is independent of match RNG and covered parks avoid rain cancellations', () => {
  const g = game(),
    fixture = e.ownFixtures(g)[0];
  const initial = matchWeather(g, fixture, club(fixture.home));
  g.seed += 99;
  assert.deepEqual(matchWeather(g, fixture, club(fixture.home)), initial);
  for (let seed = 0; seed < 200; seed++) {
    g.weather.seed = seed;
    const covered = matchWeather(g, { home: 'kbo-kiwoom', date: fixture.date }, club('kbo-kiwoom'));
    assert.equal(covered.cancellation, undefined);
    assert.equal(covered.rainfall, 0);
    assert.equal(covered.ground, 'dry');
  }
  assert.equal(world.clubs.filter((c) => c.ballpark?.roof === 'covered').length, 15);
});

for (const reason of ['rain', 'ground'])
  test(`${reason} cancellation moves a regular game to a free date without counting a loss`, () => {
    const g = game(),
      fixture = e.ownFixtures(g)[0];
    seedFor(g, () => matchWeather(g, fixture, club(fixture.home)).cancellation === reason);
    const stats = structuredClone(g.roster.map((p) => p.stats)),
      starter = g.starter,
      standing = structuredClone(g.standings.kbo.find((s) => s.club === g.club));
    assert.equal(e.nextFixture(g), null);
    const other = structuredClone(g);
    e.advance(g, 1);
    const moved = g.weather.postponed[fixture.id];
    assert.ok(moved);
    assert.equal(moved.cancellations[0].reason, reason);
    assert.notEqual(moved.fixture.date, fixture.date);
    assert.equal(g.history.length, 0);
    assert.equal(g.starter, starter);
    assert.deepEqual(
      g.roster.map((p) => p.stats),
      stats,
    );
    assert.deepEqual(
      g.standings.kbo.find((s) => s.club === g.club),
      standing,
    );
    assert.ok(e.fixtures(other, 'kbo').some((f) => f.id === fixture.id && f.date === fixture.date));
    assert.ok(!e.fixtures(g, 'kbo').some((f) => f.id === fixture.id && f.date === fixture.date));
    const clashes = e
      .fixtures(g, 'kbo')
      .filter(
        (f) =>
          f.date === moved.fixture.date &&
          [f.home, f.away].some((id) => id === fixture.home || id === fixture.away),
      );
    assert.deepEqual(
      clashes.map((f) => f.id),
      [fixture.id],
    );
    assert.equal(g.news.filter((n) => n.sender?.role === '일정 변경').length, 1);
  });

test('A cancelled regular-season finale is played before qualification starts', () => {
  const local = structuredClone(world);
  local.fixtures = [
    { id: 'last-game', league: 'kbo', date: '2026-03-28', home: 'kbo-kia', away: 'kbo-lg' },
  ];
  const engine = createGameEngine(local),
    g = engine.newGame('kbo-kia', 'Finale', 'full', 7, { preseason: false }),
    fixture = local.fixtures[0];
  seedFor(
    g,
    () =>
      !!matchWeather(g, fixture, club(fixture.home)).cancellation &&
      !matchWeather(g, { ...fixture, date: addDays(fixture.date, 1) }, club(fixture.home))
        .cancellation,
  );
  engine.advance(g, 1);
  assert.equal(g.phase, 'regular');
  assert.equal(g.rounds, 2);
  assert.equal(g.history.length, 0);
  engine.advance(g, 1);
  assert.equal(g.phase, 'wildcard');
  assert.equal(g.postseason.seeds.length, 5);
  assert.equal(g.history[0].fixtureId, 'last-game');
  assert.equal(g.history[0].date, '2026-03-29');
  assert.equal(
    g.standings.kbo.reduce((sum, s) => sum + s.w, 0),
    1,
  );
});

test('Postseason postponement shifts every remaining game without advancing that series', () => {
  const g = bracket(),
    fixture = postseasonFixtures(g)[0],
    original = structuredClone(postseasonFixtures(g));
  seedFor(g, () => !!matchWeather(g, fixture, club(fixture.home)).cancellation);
  const day = g.day;
  postponeForWeather(g, fixture, world);
  assert.deepEqual(g.series[0], { a: g.club, b: 'kbo-lg', aw: 0, bw: 0 });
  assert.equal(g.day, day);
  for (const f of postseasonFixtures(g).filter((f) => f.seriesIndex === 0))
    assert.equal(f.date, addDays(original.find((old) => old.id === f.id).date, 1));
  assert.deepEqual(
    postseasonFixtures(g).filter((f) => f.seriesIndex === 1),
    original.filter((f) => f.seriesIndex === 1),
  );
  assert.equal(e.nextFixture(g), null);
  assert.equal(g.weather.postponed[fixture.id].cancellations.length, 1);
});

test('An already started match retains its conditions even when a legacy weather state changes', () => {
  let g = game(),
    fixture = e.ownFixtures(g)[0];
  seedFor(g, () => !matchWeather(g, fixture, club(fixture.home)).cancellation);
  g = e.applyAction(g, { type: 'startMatch' });
  const frozen = structuredClone(g.liveMatch.weather);
  seedFor(g, () => !!matchWeather(g, fixture, club(fixture.home)).cancellation);
  assert.ok(e.nextFixture(g));
  assert.equal(postponeForWeather(g, fixture, world), false);
  assert.deepEqual(g.liveMatch.weather, frozen);
  const live = g.liveMatch;
  g = e.applyAction(g, {
    type: 'delegateMatch',
    date: gameDate(g),
    cursor: 0,
    timelineVersion: live.timelineVersion,
    playbackId: live.playbackId,
  });
  assert.equal(g.history[0].fixtureId, fixture.id);
  assert.deepEqual(g.history[0].weather, frozen);
  assert.equal(Object.keys(g.weather.postponed).includes(fixture.id), false);
});
