import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/web/src/features/matches/coach-match-command';export * from './packages/shared/src/match-decision';export * from './packages/shared/src/match-commands';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  engine: e,
  coachMatchCommand,
  matchDecision,
  matchCommandOptions,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
function game() {
  return e.applyAction(
    e.newGame('kbo-lotte', '양방향 작전 검증', 'full', 407, { preseason: false }),
    { type: 'startMatch' },
  );
}
test('Both batting and pitching recommendations use current players and consumed plays only', () => {
  const g = game();
  const roles = new Set();
  for (let cursor = 0; cursor < g.liveMatch.timeline.log.length; cursor++) {
    const advice = coachMatchCommand(g, cursor),
      decision = matchDecision(g.liveMatch, g.club, cursor);
    assert.ok(advice);
    roles.add(advice.role);
    const player = g.roster.find(
      (p) => p.id === (decision.attacking ? decision.batterId : decision.pitcherId),
    );
    assert.equal(advice.player, player.name);
    assert.match(advice.profile, /경기 체력/);
    assert.equal(
      matchCommandOptions(g.liveMatch, g.club, cursor).find((o) => o.kind === advice.command)
        .reason,
      '',
    );
    const hidden = structuredClone(g);
    hidden.liveMatch.timeline.log.splice(cursor, Infinity, {
      inning: 99,
      half: 0,
      score: [100, 0],
      text: '미래 결과',
    });
    assert.deepEqual(coachMatchCommand(hidden, cursor), advice);
  }
  assert.deepEqual([...roles].sort(), ['타격', '투수']);
  assert.equal(coachMatchCommand(g, g.liveMatch.timeline.log.length), undefined);
});
test('Pitching advice changes with control, stuff and base situation and saves through server commands', () => {
  const g = game(),
    live = g.liveMatch;
  const cursor =
    live.timeline.log.findIndex(
      (event) => event.half !== (live.home === g.club ? 1 : 0) && event.play?.after.outs < 3,
    ) + 1;
  assert.ok(cursor > 0);
  const decision = matchDecision(live, g.club, cursor),
    pitcher = g.roster.find((p) => p.id === decision.pitcherId);
  g.staff.find((c) => c.role === '투수').skill = 100;
  const after = live.timeline.log[cursor - 1].play.after;
  after.outs = 1;
  after.bases = ['runner-1', 'runner-2', null];
  pitcher.control = 85;
  pitcher.stuff = 50;
  assert.equal(coachMatchCommand(g, cursor).command, 'induceGrounder');
  after.outs = 2;
  pitcher.control = 90;
  pitcher.stuff = 100;
  assert.equal(coachMatchCommand(g, cursor).command, 'pitchAround');
  after.bases = ['runner-1', 'runner-2', 'runner-3'];
  pitcher.control = 30;
  assert.equal(coachMatchCommand(g, cursor).command, 'attackBatter');
  const actual = game();
  const advice = coachMatchCommand(actual, cursor);
  const next = e.applyAction(actual, {
    type: 'matchCommand',
    command: advice.command,
    cursor,
    timelineVersion: actual.liveMatch.timelineVersion,
  });
  assert.deepEqual(
    next.liveMatch.timeline.log.slice(0, cursor),
    actual.liveMatch.timeline.log.slice(0, cursor),
  );
  assert.equal(next.liveMatch.commands.at(-1).kind, advice.command);
});
