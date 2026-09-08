import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-timeline-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/live-match';export * from './apps/api/src/domain/match-simulation';export * from './apps/api/src/domain/match-timeline';export * from './apps/api/src/services/presentation';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
});
const {
  engine: e,
  world,
  createLiveMatchActions,
  createMatchSimulator,
  runMatch,
  MAX_MATCH_EVENTS,
  presentState,
  applyMatchEffects,
} = createRequire(import.meta.url)(output);
const ready = () => {
  const g = e.newGame('kbo-lotte', 'Timeline QA', 'full', 407);
  g.day = -22;
  return g;
};
const start = () => e.applyAction(ready(), { type: 'startMatch' });
const plan = (g, cursor, overrides = {}) => {
  const l = g.liveMatch,
    own = l.home === g.club ? 1 : 0;
  return {
    type: 'reviseMatch',
    cursor,
    timelineVersion: l.timelineVersion,
    lineup: [...g.lineup],
    pitcher:
      l.timeline.log
        .slice(0, cursor)
        .filter((x) => x.half !== own && x.play)
        .at(-1)?.play.pitcher || g.starter,
    instructions: { ...g.instructions },
    ...overrides,
  };
};

test('A saved timeline runs one simulation; cursor playback and final effects do not simulate again', () => {
  let calls = 0;
  const simulate = createMatchSimulator(world);
  const live = createLiveMatchActions(
    world,
    (...args) => {
      calls++;
      return simulate(...args);
    },
    (g) => {
      applyMatchEffects(g);
      return g;
    },
  );
  let g = ready();
  const original = structuredClone(g.roster);
  g = live(g, { type: 'startMatch' });
  assert.equal(calls, 1);
  assert.ok(g.liveMatch.timeline.log.length > 50);
  assert.deepEqual(g.roster, original);
  const timeline = structuredClone(g.liveMatch.timeline);
  const safe = presentState(g);
  assert.equal(safe.liveMatch.prepared, undefined);
  assert.equal(safe.liveMatch.opponents, undefined);
  for (let i = 0; i < timeline.log.length; i++)
    g = live(JSON.parse(JSON.stringify(g)), { type: 'stepMatch' });
  assert.equal(calls, 1);
  assert.deepEqual(g.liveMatch.timeline, timeline);
  const effects = structuredClone(g.liveMatch.prepared.effects);
  g = live(g, { type: 'completeMatch' });
  assert.equal(calls, 1);
  for (const effect of effects)
    assert.deepEqual(g.roster.find((p) => p.id === effect.id).stats, effect.stats);
  assert.equal(g.liveMatch, undefined);
});

test('Preview edits regenerate one game with the selected lineup, starter and tactics without spending a day', () => {
  const g = start(),
    before = structuredClone(g);
  const bench = g.roster.find(
    (p) => p.squad !== 'reserve' && p.pos !== 'P' && !g.lineup.includes(p.id),
  );
  const lineup = [...g.lineup];
  lineup[0] = bench.id;
  const pitcher = g.pitching.bullpen[0];
  const next = e.applyAction(
    g,
    plan(g, 0, { lineup, pitcher, instructions: { ...g.instructions, power: 100 } }),
  );
  const side = next.liveMatch.home === g.club ? 1 : 0;
  assert.equal(next.liveMatch.timelineVersion, 2);
  assert.equal(next.liveMatch.timeline.replayTeams[side].lineup[0], bench.id);
  assert.equal(next.liveMatch.timeline.replayTeams[side].defense.P, pitcher);
  assert.equal(next.day, before.day);
  assert.equal(next.budget, before.budget);
  assert.deepEqual(next.roster, before.roster);
  assert.notDeepEqual(next.liveMatch.timeline.log, before.liveMatch.timeline.log);
  assert.deepEqual(g, before);
});

test('In-game batting and tactical changes preserve every consumed event and replace only the future', () => {
  const g = start(),
    cursor = 12,
    prefix = structuredClone(g.liveMatch.timeline.log.slice(0, cursor));
  const bench = g.roster.find(
    (p) => p.squad !== 'reserve' && p.pos !== 'P' && !g.lineup.includes(p.id),
  );
  const lineup = [...g.lineup];
  lineup[0] = bench.id;
  let next = e.applyAction(
    g,
    plan(g, cursor, { lineup, instructions: { ...g.instructions, power: 100 } }),
  );
  assert.deepEqual(next.liveMatch.timeline.log.slice(0, cursor), prefix);
  assert.ok(next.liveMatch.timeline.log.slice(cursor).some((e) => e.play?.batter === bench.id));
  assert.notDeepEqual(
    next.liveMatch.timeline.log.slice(cursor),
    g.liveMatch.timeline.log.slice(cursor),
  );
  const restored = JSON.parse(JSON.stringify(next));
  const total = next.liveMatch.timeline.log.length;
  next = e.applyAction(restored, { type: 'completeMatch', cursor: total, timelineVersion: 2 });
  assert.deepEqual(next.history[0].log.slice(0, cursor), prefix);
  assert.equal(next.history.length, 1);
  assert.equal(next.liveMatch, undefined);
});

test('A manual relief pitcher is used on the next defensive PA and cannot re-enter later', () => {
  const g = start(),
    own = g.liveMatch.home === g.club ? 1 : 0;
  const cursor = g.liveMatch.timeline.log.findIndex((e, i) => i >= 12 && e.half !== own);
  const prefix = g.liveMatch.timeline.log.slice(0, cursor);
  const used = new Set(prefix.filter((e) => e.half !== own).map((e) => e.play?.pitcher));
  const incoming = g.roster.find(
    (p) => p.squad !== 'reserve' && p.pos === 'P' && !used.has(p.id) && p.id !== g.starter,
  );
  const next = e.applyAction(g, plan(g, cursor, { pitcher: incoming.id }));
  assert.deepEqual(next.liveMatch.timeline.log.slice(0, cursor), prefix);
  assert.equal(next.liveMatch.timeline.log[cursor].play.pitcher, incoming.id);
  const later = next.liveMatch.timeline.log.findIndex((x, i) => i > cursor && x.half !== own);
  assert.throws(() => e.applyAction(next, plan(next, later, { pitcher: g.starter })), /다시 등판/);
});

test('Invalid, stale, backwards, re-entry and completed-match changes leave the source untouched', () => {
  const g = start(),
    original = structuredClone(g);
  const reserve = g.roster.find((p) => p.squad === 'reserve' && p.pos !== 'P');
  const bad = [...g.lineup];
  bad[0] = reserve.id;
  assert.throws(() => e.applyAction(g, plan(g, 0, { lineup: bad })), /1군 야수/);
  assert.throws(() => e.applyAction(g, plan(g, 0, { timelineVersion: 0 })), /다른 화면/);
  assert.throws(() => e.applyAction(g, plan(g, 0, { instructions: { power: Infinity } })), /0~100/);
  const next = e.applyAction(g, { type: 'matchCursor', cursor: 12, timelineVersion: 1 });
  assert.throws(() => e.applyAction(next, plan(next, 11)), /재생 위치/);
  const swapped = [...g.lineup];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.throws(() => e.applyAction(g, plan(g, 12, { lineup: swapped })), /타순/);
  assert.throws(() => e.applyAction(g, plan(g, g.liveMatch.timeline.log.length)), /종료된/);
  assert.deepEqual(g, original);
});

test('Simulation draining rejects an unbounded generator before any career save', () => {
  let iterations = 0;
  function* infinite() {
    while (true) {
      iterations++;
      yield {};
    }
  }
  assert.throws(() => runMatch(infinite()), /한도/);
  assert.ok(iterations <= MAX_MATCH_EVENTS + 3);
});
