import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export { gameDate } from './packages/shared/src/calendar';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { engine: e, gameDate } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
function ready() {
  let g = e.newGame('kbo-lotte', '경기 위임 QA', 'short', 823);
  g.day = -22;
  return e.applyAction(g, { type: 'auto' });
}
test('Delegating a whole game records real commands, one result and post-match conversation', () => {
  const g = ready(),
    before = structuredClone(g);
  const next = e.applyAction(g, { type: 'delegateMatch', date: gameDate(g) });
  assert.deepEqual(g, before);
  assert.equal(next.history.length, 1);
  assert.equal(next.liveMatch, undefined);
  assert.ok(next.history[0].delegatedBy);
  assert.ok(next.history[0].log.some((p) => p.play?.command));
  assert.ok(next.media.pending);
  assert.throws(() => e.applyAction(next, { type: 'delegateMatch', date: gameDate(g) }));
});
test('Mid-game delegation keeps the exact consumed prefix and rejects stale timelines', () => {
  const g = e.applyAction(ready(), { type: 'startMatch' }),
    live = g.liveMatch,
    cursor = 12;
  const action = {
    type: 'delegateMatch',
    date: gameDate(g),
    cursor,
    timelineVersion: live.timelineVersion,
    playbackId: live.playbackId,
  };
  assert.throws(() => e.applyAction(g, { ...action, timelineVersion: 999 }), /타임라인/);
  const next = e.applyAction(g, action);
  assert.deepEqual(next.history[0].log.slice(0, cursor), live.timeline.log.slice(0, cursor));
  assert.ok(next.history[0].log.slice(cursor).some((p) => p.play?.command));
});
test('Delegation requires a coaching appointment and the current match date', () => {
  const g = ready();
  assert.throws(() => e.applyAction(g, { type: 'delegateMatch', date: '2000-01-01' }), /날짜/);
  g.staff = g.staff.filter((c) => c.role === '스카우트');
  assert.throws(() => e.applyAction(g, { type: 'delegateMatch', date: gameDate(g) }), /코치/);
});
