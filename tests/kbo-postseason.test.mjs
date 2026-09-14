import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-kbo-postseason.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/postseason-calendar';export * from './packages/shared/src/postseason';export * from './packages/shared/src/season-status';export * from './packages/shared/src/calendar';",
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
  beginPostseason,
  preparePostseason,
  recordPostseason,
  advancePostseasonRound,
  postseasonWinner,
  postseasonWaitingStage,
  clubSeasonStatus,
  isClubSeasonRest,
  gameDate,
  addDays,
  daysBetween,
} = createRequire(import.meta.url)(out);
const seeds = ['kbo-kia', 'kbo-lg', 'kbo-ssg', 'kbo-doosan', 'kbo-lotte'];
function game(rank = 1) {
  const g = e.newGame(seeds[rank - 1], 'KBO 감독', 'short', 45, { preseason: false });
  g.news = [];
  g.day = g.rounds;
  const ids = [
    ...seeds,
    ...world.clubs.filter((c) => c.league === 'kbo' && !seeds.includes(c.id)).map((c) => c.id),
  ];
  for (const [i, id] of ids.entries())
    Object.assign(
      g.standings.kbo.find((s) => s.club === id),
      { w: 100 - i * 5, l: 40 + i * 5 },
    );
  return g;
}
function post(rank = 1) {
  const g = game(rank);
  beginPostseason(g, 'kbo', seeds, g.day + 1);
  return g;
}
function result(g, side, draw = false) {
  const round = g.postseason.rounds.find((r) => r.stage === g.phase),
    f = round.fixtures.find((f) => f.status === 'scheduled');
  g.day += daysBetween(gameDate(g), f.date);
  recordPostseason(g, {
    fixtureId: f.id,
    home: f.home,
    away: f.away,
    homeScore: draw ? 2 : side === f.home ? 3 : 1,
    awayScore: draw ? 2 : side === f.away ? 3 : 1,
  });
}
test('KBO seeds one to three wait at their entry rounds and only four and five start the wild card', () => {
  for (let rank = 1; rank <= 5; rank++) {
    const g = post(rank);
    assert.equal(g.phase, 'wildcard');
    assert.equal(g.postseason.seeds.length, 5);
    assert.deepEqual(
      g.series.map((s) => [s.a, s.b]),
      [[seeds[3], seeds[4]]],
    );
    assert.deepEqual(
      g.postseason.rounds[0].fixtures.map((f) => f.home),
      [seeds[3], seeds[3]],
    );
    assert.equal(g.series[0].aw, 0);
    assert.equal(g.series[0].advantageA, 1);
    assert.equal(
      postseasonWaitingStage(g),
      rank === 1 ? 'final' : rank === 2 ? 'playoff' : rank === 3 ? 'semifinal' : undefined,
    );
    assert.equal(clubSeasonStatus(g).eliminated, false);
    assert.equal(isClubSeasonRest(g), false);
    assert.equal(e.nextFixture(g), null); // travel day, then only seeds four and five may play
  }
});
for (const draw of [false, true])
  test(`Fourth seed advances with one ${draw ? 'draw' : 'win'} without a fabricated victory`, () => {
    const g = post(4);
    result(g, seeds[3], draw);
    const s = g.series[0];
    assert.equal(s.aw, draw ? 0 : 1);
    assert.equal(s.draws || 0, draw ? 1 : 0);
    assert.equal(postseasonWinner(s, 2), seeds[3]);
    assert.equal(g.postseason.rounds[0].fixtures[1].status, 'cancelled');
    const date = gameDate(g);
    assert.equal(advancePostseasonRound(g), 'advanced');
    assert.equal(g.phase, 'semifinal');
    assert.deepEqual(
      g.series.map((s) => [s.a, s.b]),
      [[seeds[2], seeds[3]]],
    );
    assert.equal(g.postseason.rounds[1].fixtures[0].date, addDays(date, 2));
  });
test('Fifth seed needs two wins; eliminating it does not eliminate teams waiting above it', () => {
  const g = post(5);
  result(g, seeds[4]);
  assert.equal(postseasonWinner(g.series[0], 2), undefined);
  assert.equal(advancePostseasonRound(g), 'waiting');
  assert.equal(g.postseason.rounds[0].fixtures[1].status, 'scheduled');
  result(g, seeds[4]);
  assert.equal(postseasonWinner(g.series[0], 2), seeds[4]);
  advancePostseasonRound(g);
  assert.equal(g.series[0].a, seeds[2]);
  assert.equal(g.series[0].b, seeds[4]);
  assert.equal(clubSeasonStatus({ ...g, club: seeds[3] }).eliminated, true);
  assert.equal(clubSeasonStatus({ ...g, club: seeds[0] }).waiting, 'final');
});
test('KBO home games and travel days follow 2-2-1 and 2-3-2 series patterns', () => {
  for (const stage of ['semifinal', 'playoff', 'final']) {
    const g = post();
    g.phase = stage;
    g.series = [{ a: seeds[0], b: seeds[4], aw: 0, bw: 0 }];
    preparePostseason(g, 'kbo');
    const fs = g.postseason.rounds.find((r) => r.stage === stage).fixtures;
    assert.deepEqual(
      fs.map((f) => f.home),
      stage === 'final'
        ? [seeds[0], seeds[0], seeds[4], seeds[4], seeds[4], seeds[0], seeds[0]]
        : [seeds[0], seeds[0], seeds[4], seeds[4], seeds[0]],
    );
    for (let i = 1; i < fs.length; i++)
      assert.equal(daysBetween(fs[i - 1].date, fs[i].date), fs[i - 1].home === fs[i].home ? 1 : 2);
  }
});
test('The first seed plays no earlier round and wins the season only after four Korean Series victories', () => {
  const g = post(),
    regular = structuredClone(g.standings.kbo);
  let days = 0;
  while (g.phase !== 'final' && days++ < 90) {
    e.advance(g, 1);
    assert.equal(g.history.length, 0);
  }
  assert.equal(g.phase, 'final');
  assert.equal(g.series[0].a, seeds[0]);
  assert.equal(g.postseason.rounds.length, 4);
  while (g.phase !== 'finished' && days++ < 150) e.advance(g, 1);
  assert.equal(g.phase, 'finished');
  const series = g.postseason.rounds.at(-1).series[0];
  assert.equal(Math.max(series.aw, series.bw), 4);
  assert.ok(g.history.every((r) => r.fixtureId.includes('-final-')));
  assert.deepEqual(g.standings.kbo, regular);
});
test('An unplayed old KBO bracket is corrected, while played brackets and live games keep their results', () => {
  const g = game();
  g.phase = 'semifinal';
  g.series = [
    { a: seeds[0], b: seeds[3], aw: 0, bw: 0 },
    { a: seeds[1], b: seeds[2], aw: 0, bw: 0 },
  ];
  const seed = g.seed;
  preparePostseason(g, 'kbo');
  assert.equal(g.postseason.format, 'kbo');
  assert.equal(g.phase, 'wildcard');
  assert.equal(g.seed, seed);
  assert.deepEqual(g.postseason.seeds, seeds);
  const before = structuredClone(g);
  preparePostseason(g, 'kbo');
  assert.deepEqual(g, before);
  for (const live of [false, true]) {
    const old = game();
    old.phase = 'semifinal';
    old.series = [
      { a: seeds[0], b: seeds[3], aw: live ? 0 : 1, bw: 0 },
      { a: seeds[1], b: seeds[2], aw: 0, bw: 0 },
    ];
    if (live) old.liveMatch = { home: seeds[0], away: seeds[3] };
    const saved = structuredClone(old.series);
    preparePostseason(old, 'kbo');
    assert.equal(old.postseason.format, 'four-team');
    assert.equal(old.phase, 'semifinal');
    assert.deepEqual(old.series, saved);
  }
});
test('Other leagues retain the four-team bracket', () => {
  const g = game();
  const ids = world.clubs.filter((c) => c.league === 'mlb').map((c) => c.id);
  beginPostseason(g, 'mlb', ids);
  assert.equal(g.phase, 'semifinal');
  assert.equal(g.postseason.format, 'four-team');
  assert.equal(g.postseason.seeds.length, 4);
});
