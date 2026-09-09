import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output = join(tmpdir(), 'dugout-energy-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './packages/shared/src/match-energy'; export * from './packages/shared/src/match-commands'; export * from './apps/api/src/domain/match-energy';",
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
  matchEnergy,
  matchCommandOptions,
  createMatchEnergy,
} = createRequire(import.meta.url)(output);
const start = () => {
  const g = e.newGame('kbo-lotte', '경기 피로 검증', 'short', 407);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch' });
};

test('Visible match energy uses only watched events and equals the condition applied at completion', () => {
  const g = start(),
    live = g.liveMatch;
  const before = matchEnergy(live.timeline, 0),
    after = matchEnergy(live.timeline, live.timeline.log.length);
  for (const p of g.roster) {
    if (before.has(p.id)) assert.equal(before.get(p.id), p.condition);
    if (after.has(p.id))
      assert.equal(after.get(p.id), live.prepared.effects.find((x) => x.id === p.id).condition);
  }
  const first = live.timeline.log.findIndex((event) => event.play?.energy) + 1;
  const observed = matchEnergy(live.timeline, first);
  const prefix = { ...live.timeline, log: live.timeline.log.slice(0, first) };
  assert.deepEqual(observed, matchEnergy(prefix, first));
  assert.ok([...after.entries()].some(([id, value]) => value < before.get(id)));
});

test('Defensive pitching commands preserve watched events and intentional walks advance runners with one BB', () => {
  for (const kind of ['intentionalWalk', 'attackBatter', 'pitchAround', 'induceGrounder']) {
    const g = start(),
      live = g.liveMatch;
    const cursor = live.timeline.log.findIndex(
      (_, i) =>
        i > 0 && matchCommandOptions(live, g.club, i).some((o) => o.kind === kind && !o.reason),
    );
    assert.ok(cursor > 0);
    const next = e.applyAction(g, {
      type: 'matchCommand',
      command: kind,
      cursor,
      timelineVersion: live.timelineVersion,
    });
    const play = next.liveMatch.timeline.log[cursor].play;
    assert.equal(play.command, kind);
    assert.deepEqual(
      next.liveMatch.timeline.log.slice(0, cursor),
      live.timeline.log.slice(0, cursor),
    );
    assert.deepEqual(next.roster, g.roster);
    if (kind === 'intentionalWalk') {
      assert.equal(play.before.outs, play.after.outs);
      assert.equal(play.after.bases[0], play.batter);
      assert.ok(play.energy.batter[0] - play.energy.batter[1] <= 0.61);
    }
    const restored = JSON.parse(JSON.stringify(next));
    const cancelled = e.applyAction(restored, {
      type: 'cancelMatchCommand',
      cursor,
      timelineVersion: 2,
    });
    assert.deepEqual(cancelled.liveMatch.timeline.log, live.timeline.log);
  }
});

test('Relievers pay their entry workload once and legacy games keep their original energy', () => {
  const roster = start().roster,
    pitcher = roster.find((p) => p.pos === 'P'),
    batter = roster.find((p) => p.pos !== 'P');
  const play = () => ({
    command: undefined,
    before: { bases: [], outs: 0 },
    after: { bases: [], outs: 1 },
  });
  const legacy = createMatchEnergy([roster], false, []),
    old = play();
  legacy.record(old, pitcher, batter, [], 'balanced', '삼진');
  assert.equal(old.energy, undefined);
  assert.equal(legacy.get(pitcher), pitcher.condition);
  const relief = createMatchEnergy([roster], true, []),
    first = play(),
    second = play();
  relief.record(first, pitcher, batter, [], 'balanced', '삼진');
  relief.record(second, pitcher, batter, [], 'balanced', '삼진');
  assert.ok(first.energy.pitcher[0] - first.energy.pitcher[1] > 10);
  assert.ok(second.energy.pitcher[0] - second.energy.pitcher[1] < 3);
});
