import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-command-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './packages/shared/src/match-commands'; export * from './packages/shared/src/replay'; export * from './apps/api/src/domain/match-command-probabilities';",
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
  matchCommandOptions,
  replayScene,
  stealChance,
  buntResult,
} = createRequire(import.meta.url)(output);
function start(seed = 407) {
  const g = e.newGame('kbo-lotte', 'Command QA', 'short', seed);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch' });
}
const available = (g, kind) =>
  g.liveMatch.timeline.log.findIndex(
    (_, i) =>
      i > 0 &&
      matchCommandOptions(g.liveMatch, g.club, i).some((o) => o.kind === kind && !o.reason),
  );
const command = (g, kind, cursor = available(g, kind)) => {
  assert.ok(cursor > 0, kind);
  return e.applyAction(g, {
    type: 'matchCommand',
    command: kind,
    cursor,
    timelineVersion: g.liveMatch.timelineVersion,
  });
};

test('Every direct instruction retains the watched prefix, immutable career and deterministic saved future', () => {
  for (const kind of ['stealSecond', 'stealThird', 'bunt', 'hitAndRun']) {
    const g = start(),
      before = structuredClone(g),
      cursor = available(g, kind),
      next = command(g, kind, cursor);
    assert.deepEqual(g, before);
    assert.deepEqual(next.roster, g.roster);
    assert.equal(next.day, g.day);
    assert.equal(next.budget, g.budget);
    assert.deepEqual(
      next.liveMatch.timeline.log.slice(0, cursor),
      g.liveMatch.timeline.log.slice(0, cursor),
    );
    assert.equal(next.liveMatch.timelineVersion, 2);
    assert.equal(next.liveMatch.cursor, cursor);
    assert.equal(next.liveMatch.timeline.log[cursor].play.command, kind);
    const restored = JSON.parse(JSON.stringify(next));
    const cancelled = e.applyAction(restored, {
      type: 'cancelMatchCommand',
      cursor,
      timelineVersion: 2,
    });
    assert.deepEqual(cancelled.liveMatch.timeline.log, g.liveMatch.timeline.log);
    const reapplied = command(cancelled, kind, cursor);
    assert.deepEqual(reapplied.liveMatch.timeline, next.liveMatch.timeline);
    const saved = e.applyAction(restored, {
      type: 'completeMatch',
      cursor: next.liveMatch.timeline.log.length,
      timelineVersion: 2,
    });
    assert.equal(saved.history.length, 1);
    assert.deepEqual(saved.history[0].log, next.liveMatch.timeline.log);
    assert.equal(saved.liveMatch, undefined);
  }
});

test('Standalone steals move only the runner, consume no plate appearance and record real SB/CS once', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 16; seed++) {
    const g = start(seed),
      cursor = available(g, 'stealSecond');
    if (cursor < 0) continue;
    const next = command(g, 'stealSecond', cursor),
      result = next.liveMatch.timeline,
      event = result.log[cursor],
      p = event.play;
    assert.equal(p.plateAppearance, false);
    assert.equal(p.batter, g.liveMatch.timeline.log[cursor].play.batter);
    assert.equal(p.after.outs - p.before.outs, p.steal.safe ? 0 : 1);
    assert.equal(p.after.bases[0], null);
    assert.equal(p.after.bases[1], p.steal.safe ? p.steal.runner : null);
    const scene = replayScene(result, cursor);
    assert.ok(scene.runners.every((r) => r.from > 0));
    assert.equal(scene.fly, false);
    if (p.after.outs < 3) assert.equal(result.log[cursor + 1].play.batter, p.batter);
    const own = next.liveMatch.home === g.club ? 1 : 0;
    const effects = next.liveMatch.prepared.effects;
    for (const effect of effects) {
      const events = result.log.filter(
        (x) => x.half === own && x.play?.steal?.runner === effect.id,
      );
      assert.equal(effect.stats.sb || 0, events.filter((x) => x.play.steal.safe).length);
      assert.equal(effect.stats.cs || 0, events.filter((x) => !x.play.steal.safe).length);
      const appearances = result.log.filter(
        (x) => x.half === own && x.play?.batter === effect.id && x.play.plateAppearance !== false,
      );
      // This test issues no bunts: every counted PA is an AB or walk.
      if (g.roster.find((x) => x.id === effect.id).pos !== 'P')
        assert.equal(effect.stats.ab + effect.stats.bb, appearances.length);
    }
    outcomes.add(p.steal.safe);
  }
  assert.deepEqual(outcomes, new Set([true, false]));
});

test('Sacrifice bunts credit SH instead of AB; third-base steals and bunt replay use the correct field action', () => {
  let sacrifices = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const g = start(seed),
      cursor = available(g, 'bunt');
    if (cursor < 0) continue;
    const next = command(g, 'bunt', cursor),
      result = next.liveMatch.timeline,
      play = result.log[cursor].play;
    if (result.log[cursor].text.includes('희생번트 성공')) {
      sacrifices++;
      assert.equal(play.after.outs, play.before.outs + 1);
      assert.equal(play.after.bases[1], play.before.bases[0]);
      assert.equal(play.after.bases[2], play.before.bases[1]);
      const own = next.liveMatch.home === g.club ? 1 : 0,
        effect = next.liveMatch.prepared.effects.find((x) => x.id === play.batter);
      assert.equal(effect.stats.sh, 1);
      const pas = result.log.filter(
        (x) => x.half === own && x.play?.batter === play.batter && x.play.plateAppearance !== false,
      );
      assert.equal(effect.stats.ab + effect.stats.bb + effect.stats.sh, pas.length);
    }
    const scene = replayScene(result, cursor);
    assert.equal(scene.fielder, 'P');
    assert.equal(scene.fly, false);
  }
  assert.ok(sacrifices > 0);
  const g = start(),
    cursor = available(g, 'stealThird'),
    next = command(g, 'stealThird', cursor),
    scene = replayScene(next.liveMatch.timeline, cursor);
  assert.equal(scene.fielder, '3B');
  assert.equal(scene.play.steal.to, 3);
  assert.ok(scene.runners.some((r) => r.from === 2 && r.to === 3));
});

test('Invalid commands, opponent turns, stale cursors, full change budget and replayed cancellation are rejected', () => {
  const g = start(),
    before = structuredClone(g),
    cursor = available(g, 'bunt');
  for (const [kind, at, version] of [
    ['bunt', 0, 1],
    ['unknown', cursor, 1],
    ['bunt', cursor, 0],
  ])
    assert.throws(() =>
      e.applyAction(g, {
        type: 'matchCommand',
        command: kind,
        cursor: at,
        timelineVersion: version,
      }),
    );
  const own = g.liveMatch.home === g.club ? 1 : 0;
  const other = g.liveMatch.timeline.log.findIndex(
    (x, i) => i > 0 && g.liveMatch.timeline.log[i - 1].half !== own,
  );
  assert.throws(() => command(g, 'stealSecond', other), /우리 팀 공격/);
  const late = structuredClone(g);
  late.liveMatch.cursor = cursor + 1;
  assert.throws(() => command(late, 'bunt', cursor), /재생 위치/);
  const max = structuredClone(g);
  max.liveMatch.changes = Array(40).fill({});
  assert.throws(() => command(max, 'bunt', cursor), /횟수/);
  const next = command(g, 'bunt', cursor);
  assert.throws(
    () =>
      e.applyAction(next, { type: 'cancelMatchCommand', cursor: cursor + 1, timelineVersion: 2 }),
    /취소할/,
  );
  assert.deepEqual(g, before);
});

test('Command success probabilities respond to speed, fatigue, contact and defensive opposition', () => {
  const g = start(),
    runner = g.roster.find((p) => p.pos !== 'P'),
    pitcher = g.roster.find((p) => p.id === g.starter);
  const fast = { ...runner, speed: 90, contact: 90, condition: 100 },
    slow = { ...runner, speed: 30, contact: 30, condition: 100 };
  assert.ok(stealChance(fast, pitcher, 50) > stealChance(slow, pitcher, 50));
  assert.ok(stealChance(fast, pitcher, 50) > stealChance({ ...fast, condition: 30 }, pitcher, 50));
  assert.ok(stealChance(fast, pitcher, 50) > stealChance(fast, pitcher, 50, true));
  assert.ok(
    stealChance(fast, { ...pitcher, control: 30 }, 30) >
      stealChance(fast, { ...pitcher, control: 90 }, 90),
  );
  const successes = (p) =>
    Array.from({ length: 100 }, (_, i) => buntResult(p, 60, 70, i / 100)).filter(
      (x) => x === 'hit' || x === 'sacrifice',
    ).length;
  assert.ok(successes(fast) > successes(slow));
  assert.ok(successes(fast) > successes({ ...fast, condition: 25 }));
});

test('Regular-season completion applies running statistics once to the career', () => {
  let g = e.newGame('kbo-lotte', 'Regular command', 'short', 407);
  g.day = 0;
  g.phase = 'regular';
  g = e.applyAction(g, { type: 'startMatch' });
  g = command(g, 'stealSecond');
  const effects = structuredClone(g.liveMatch.prepared.effects),
    timeline = g.liveMatch.timeline;
  const next = e.applyAction(g, {
    type: 'completeMatch',
    cursor: timeline.log.length,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  for (const p of next.roster) assert.deepEqual(p.stats, effects.find((x) => x.id === p.id).stats);
  assert.throws(() => e.applyAction(next, { type: 'completeMatch' }), /진행 중/);
});
