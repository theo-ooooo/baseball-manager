import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './apps/web/src/features/matches/coach-batting-command'; export * from './packages/shared/src/match-commands'; export * from './packages/shared/src/match-decision';",
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
  coachBattingCommand,
  matchCommandOptions,
  matchDecision,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);

test('batting advice uses the assigned coach, legal commands and watched situations only', () => {
  const initial = e.newGame('kbo-lotte', 'Coach batting QA', 'full', 407);
  initial.day = -22;
  const g = e.applyAction(initial, { type: 'startMatch' });
  let found = 0;
  for (let cursor = 0; cursor < g.liveMatch.timeline.log.length; cursor++) {
    const advice = coachBattingCommand(g, cursor);
    if (!matchDecision(g.liveMatch, g.club, cursor).attacking) {
      assert.equal(advice, undefined);
      continue;
    }
    assert.ok(advice);
    found++;
    assert.equal(advice.coach, g.staff.find((c) => c.role === '타격').name);
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
      text: 'unwatched',
    });
    assert.deepEqual(coachBattingCommand(hidden, cursor), advice);
    const next = e.applyAction(g, {
      type: 'matchCommand',
      command: advice.command,
      cursor,
      timelineVersion: 1,
    });
    assert.deepEqual(
      next.liveMatch.timeline.log.slice(0, cursor),
      g.liveMatch.timeline.log.slice(0, cursor),
    );
    assert.equal(next.liveMatch.commands.at(-1).kind, advice.command);
  }
  assert.ok(found > 10);
  assert.equal(coachBattingCommand(g, g.liveMatch.timeline.log.length), undefined);
  g.staff = g.staff.filter((c) => c.role !== '타격');
  assert.equal(coachBattingCommand(g, 0), undefined);
});
