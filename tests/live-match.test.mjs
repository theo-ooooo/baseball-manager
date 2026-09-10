import { reachFixture } from './helpers/manager.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const out = join(tmpdir(), 'dugout-live-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine: e } = createRequire(import.meta.url)(out);
test('Prepared game keeps the visible cursor separate and commits the completed game once', () => {
  let g = e.newGame('kbo-lotte', 'Live', 'short', 321);
  g = reachFixture(e, g);
  assert.equal(g.day, -22);
  const initial = structuredClone(g);
  g = e.applyAction(g, { type: 'startMatch' });
  assert.equal(g.liveMatch.result.log.length, 0);
  assert.equal(g.history.length, 0);
  assert.equal(g.liveMatch.result.homeScore, 0);
  assert.throws(() => e.applyAction(g, { type: 'advance', count: 1 }), /진행 중/);
  assert.throws(() => e.applyAction(g, { type: 'completeMatch' }), /끝까지/);
  g = e.applyAction(g, { type: 'stepMatch' });
  assert.equal(g.liveMatch.result.log.length, 1);
  assert.equal(g.day, -22);
  assert.deepEqual(
    g.roster.map((p) => p.stats),
    initial.roster.map((p) => p.stats),
  );
  const restored = JSON.parse(JSON.stringify(g));
  assert.deepEqual(
    e.applyAction(restored, { type: 'stepMatch' }).liveMatch,
    JSON.parse(JSON.stringify(e.applyAction(g, { type: 'stepMatch' }).liveMatch)),
  );
  let steps = 0;
  while (!g.liveMatch.finished && steps++ < 400) g = e.applyAction(g, { type: 'stepMatch' });
  assert.ok(g.liveMatch.finished);
  assert.equal(g.history.length, 0);
  const final = structuredClone(g.liveMatch.result);
  const pitchers = new Set(final.log.filter((x) => x.play).map((x) => x.play.pitcher));
  assert.ok(pitchers.size >= 4);
  g = e.applyAction(g, { type: 'completeMatch' });
  assert.equal(g.liveMatch, undefined);
  assert.equal(g.history.length, 1);
  assert.equal(g.day, -21);
  assert.equal(g.history[0].homeScore, final.homeScore);
  assert.equal(g.history[0].awayScore, final.awayScore);
  assert.deepEqual(g.history[0].log, final.log);
  assert.throws(() => e.applyAction(g, { type: 'completeMatch' }), /진행 중/);
});
test('Pitcher roles use disjoint groups and can be reassigned', () => {
  let g = e.newGame('kbo-lotte', 'Pitching', 'short', 51);
  const p = g.pitching;
  assert.equal(p.rotation.length, 5);
  assert.ok(p.closer);
  assert.ok(p.bullpen.length);
  assert.equal(
    new Set([...p.rotation, ...p.bullpen, p.closer]).size,
    p.rotation.length + p.bullpen.length + 1,
  );
  const next = p.bullpen[0],
    old = p.closer;
  g = e.applyAction(g, { type: 'pitchingRole', id: next, role: 'closer' });
  assert.equal(g.pitching.closer, next);
  assert.ok(g.pitching.bullpen.includes(old));
  assert.throws(
    () => e.applyAction(g, { type: 'pitchingRole', id: g.lineup[0], role: 'starter' }),
    /보직/,
  );
});

test('Legacy/manual starters survive catalog reads, rest dates and saved tactics', () => {
  let g = e.newGame('kbo-lotte', 'Starter', 'short', 82);
  const chosen = g.pitching.bullpen[0];
  g.starter = chosen;
  delete g.pitching;
  g = e.applyAction(g, { type: 'syncCatalog' });
  assert.equal(g.starter, chosen);
  g = e.applyAction(g, { type: 'saveTactic', name: '선발 고정' });
  const saved = g.tacticBook[0];
  g = e.applyAction(g, { type: 'starter', id: g.pitching.rotation.find((id) => id !== chosen) });
  g = e.applyAction(g, { type: 'loadTactic', id: saved.id });
  assert.equal(g.starter, chosen);
  assert.deepEqual(g.pitching, saved.pitching);
  g = e.applyAction(g, { type: 'advance', count: 1 });
  assert.equal(g.starter, chosen);
  const closer = g.pitching.closer;
  g = e.applyAction(g, { type: 'pitchingRole', id: closer, role: 'bullpen' });
  assert.equal(g.pitching.closer, '');
  assert.ok(g.pitching.bullpen.includes(closer));
});

test('Prepared postseason remains deterministic through completion and keeps the visible score at the cursor', () => {
  let g = e.newGame('kbo-lotte', 'Post', 'short', 91);
  g.phase = 'final';
  g.day = 50;
  g.series = [{ a: g.club, b: 'kbo-lg', aw: 0, bw: 0 }];
  g = e.applyAction(g, { type: 'startMatch' });
  assert.equal(g.liveMatch.result.log.length, 0);
  let steps = 0;
  while (!g.liveMatch.finished && steps++ < 1000) g = e.applyAction(g, { type: 'stepMatch' });
  assert.ok(g.liveMatch.finished);
  const log = g.liveMatch.result.log;
  g = e.applyAction(g, { type: 'completeMatch' });
  assert.deepEqual(g.history[0].log, log);
  assert.equal(g.series[0].aw + g.series[0].bw, 1);
});

test('Doubleheaders stop after the watched first game and commit distinct fixtures without duplicate wages', () => {
  const { world } = createRequire(import.meta.url)(out);
  const cloned = structuredClone(world);
  cloned.fixtures = [
    { id: 'double-a', date: '2026-03-28', league: 'kbo', home: 'kbo-lotte', away: 'kbo-lg' },
    { id: 'double-b', date: '2026-03-28', league: 'kbo', home: 'kbo-lotte', away: 'kbo-lg' },
  ];
  // Full mode uses the fixture catalog. Isolated fixture list makes the doubleheader reproducible.
  const { buildSync } = createRequire(import.meta.url)('esbuild');
  const enginePath = join(tmpdir(), 'dugout-double-engine.cjs');
  buildSync({
    entryPoints: ['apps/api/src/domain/game-engine.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: enginePath,
  });
  const engine = createRequire(import.meta.url)(enginePath).createGameEngine(cloned);
  let g = engine.newGame('kbo-lotte', 'Double', 'full', 51);
  g.phase = 'regular';
  g.day = 0;
  const originalDay = g.day;
  function finish() {
    g = engine.applyAction(g, { type: 'startMatch' });
    for (let n = 0; !g.liveMatch.finished && n < 500; n++)
      g = engine.applyAction(g, { type: 'stepMatch' });
    assert.ok(g.liveMatch.finished);
    g = engine.applyAction(g, { type: 'completeMatch' });
  }
  finish();
  assert.equal(g.day, originalDay);
  assert.equal(g.history.length, 1);
  assert.equal(g.history[0].fixtureId, 'double-a');
  const firstStarter = g.history[0].replayTeams[1].defense.P;
  finish();
  assert.equal(g.day, originalDay + 1);
  assert.equal(g.history.length, 2);
  assert.equal(g.history[0].fixtureId, 'double-b');
  assert.notEqual(g.history[0].replayTeams[1].defense.P, firstStarter);
  assert.equal(
    g.standings.kbo.find((s) => s.club === g.club).w +
      g.standings.kbo.find((s) => s.club === g.club).l +
      g.standings.kbo.find((s) => s.club === g.club).d,
    2,
  );
});
