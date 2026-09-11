import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const out = join(tmpdir(), 'dugout-replay-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/replay';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine: e, replayScene, runnerPoint, bases } = createRequire(import.meta.url)(out);
test('New matches record every plate appearance, base state and actual selected defenders', () => {
  let g = e.newGame('kbo-lotte', 'Replay', 'short', 91, { preseason: false });
  g = e.applyAction(g, { type: 'defense', id: g.defense.LF, position: 'SS' });
  const ss = g.defense.SS;
  while (g.phase === 'preseason') g = e.advance(g, 7);
  g = e.advance(g, 1);
  const r = g.history[0];
  assert.ok(r.replayTeams);
  const own = r.home === g.club ? 1 : 0;
  assert.equal(r.replayTeams[own].defense.SS, ss);
  let previous = null;
  for (const entry of r.log) {
    assert.ok(entry.play);
    const { before, after } = entry.play;
    assert.equal(before.bases.length, 3);
    assert.equal(after.bases.length, 3);
    assert.ok(after.outs >= before.outs && after.outs <= 3);
    assert.deepEqual(after.score, entry.score);
    if (previous && previous.inning === entry.inning && previous.half === entry.half)
      assert.deepEqual(before, previous.play.after);
    previous = entry;
  }
  assert.deepEqual(r.log.at(-1).play.after.score, [r.awayScore, r.homeScore]);
  const archived = structuredClone(r);
  for (let i = 0; i < archived.log.length; i++) {
    const scene = replayScene(archived, i);
    assert.ok(scene.batter);
    for (const runner of scene.runners) {
      assert.ok(runner.from >= 0 && runner.to <= 4);
      assert.ok(Number.isFinite(runnerPoint(runner.from, runner.to, 0.5).x));
    }
  }
});
test('Legacy score-only archives remain viewable without inventing runners or identities', () => {
  const r = { id: 'old', log: [{ inning: 2, half: 1, text: '전민재 안타', score: [0, 1] }] };
  const s = replayScene(r, 0);
  assert.equal(s.kind, 'single');
  assert.equal(s.batter, '전민재');
  assert.equal(s.play, undefined);
  assert.deepEqual(s.runners, []);
  assert.equal(s.defending, undefined);
});
test('Home runs round the bases and caught stealing is an out rather than a phantom run', () => {
  const event = {
    inning: 1,
    half: 0,
    text: '타자 홈런',
    score: [2, 0],
    play: {
      batter: 'b',
      pitcher: 'p',
      before: { outs: 0, bases: ['a', null, null], score: [0, 0] },
      after: { outs: 0, bases: [null, null, null], score: [2, 0] },
    },
  };
  let s = replayScene({ id: 'hr', log: [event] }, 0);
  assert.ok(s.runners.every((r) => r.to === 4 && !r.out));
  assert.deepEqual(runnerPoint(0, 4, 1), bases[0]);
  event.text = '타자 삼진 · 도루 실패';
  event.score = [0, 0];
  event.play.after = { outs: 2, bases: [null, null, null], score: [0, 0] };
  event.play.steal = { runner: 'a', safe: false };
  s = replayScene({ id: 'cs', log: [event] }, 0);
  assert.deepEqual(
    s.runners.find((r) => r.id === 'a'),
    { id: 'a', name: '', from: 1, to: 2, out: true },
  );
});

test('Mobile readout shows only consumed outcomes and applies substitutions at their saved cursor', async () => {
  const target = join(tmpdir(), 'dugout-readout-tests.cjs');
  buildSync({
    entryPoints: ['apps/web/src/features/matches/match-readout.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: target,
  });
  const { matchReadout } = createRequire(import.meta.url)(target);
  let g = e.newGame('kbo-lotte', 'Mobile replay', 'full', 402);
  for (let i = 0; i < 10 && !e.nextFixture(g); i++) g = e.applyAction(g, { type: 'continue' });
  g = e.applyAction(g, { type: 'startMatch' });
  const result = g.liveMatch.timeline;
  const before = matchReadout(result, 0);
  assert.deepEqual(before.score, [0, 0]);
  assert.ok(
    before.teams.every((team) => team.lineup.every((p) => !p.outcomes.length && !p.active)),
  );
  const consumed = matchReadout(result, 5);
  const altered = structuredClone(result);
  for (let i = 5; i < altered.log.length; i++) {
    altered.log[i].text = '미래 홈런';
    altered.log[i].score = [99, 99];
  }
  assert.deepEqual(matchReadout(altered, 5), consumed);
  assert.equal(consumed.teams.flatMap((t) => t.lineup).filter((p) => p.active).length, 1);
  const side = result.home === g.club ? 1 : 0,
    team = result.replayTeams[side];
  const sub = g.roster.find((p) => p.pos !== 'P' && !team.lineup.includes(p.id));
  const lineup = [...team.lineup];
  lineup[0] = sub.id;
  const changes = [
    {
      cursor: 8,
      lineup,
      pitcher: team.defense.P,
      defense: { ...team.defense, DH: sub.id },
      instructions: { steal: 50, patience: 50, power: 50, depth: 50 },
    },
  ];
  assert.equal(matchReadout(result, 7, side, changes).teams[side].lineup[0].id, team.lineup[0]);
  assert.equal(matchReadout(result, 8, side, changes).teams[side].lineup[0].id, sub.id);
});
