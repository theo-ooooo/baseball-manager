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

function inningAction(g, cursor = g.liveMatch.cursor) {
  return {
    type: 'delegateInning',
    date: gameDate(g),
    cursor,
    timelineVersion: g.liveMatch.timelineVersion,
    playbackId: g.liveMatch.playbackId,
  };
}
test('One-inning delegation uses real coaching and cards, stops at the next inning and preserves repeated handoffs', () => {
  let g = e.applyAction(ready(), { type: 'startMatch', matchCards: true });
  assert.throws(() => e.applyAction(g, inningAction(g)), /카드 3장/);
  g = e.applyAction(g, {
    type: 'chooseMatchCards',
    draftId: g.liveMatch.cards.id,
    ids: g.liveMatch.cards.offered.slice(0, 3).map((c) => c.id),
    timelineVersion: g.liveMatch.timelineVersion,
  });
  const cursor = 2,
    original = structuredClone(g),
    day = g.day;
  g = e.applyAction(g, inningAction(g, cursor));
  assert.deepEqual(
    original.liveMatch.timeline.log.slice(0, cursor),
    g.liveMatch.timeline.log.slice(0, cursor),
  );
  assert.equal(g.day, day);
  assert.equal(g.history.length, 0);
  assert.equal(g.liveMatch.timeline.log[g.liveMatch.cursor].inning, 2);
  assert.equal(g.liveMatch.result.log.length, g.liveMatch.cursor);
  assert.ok(g.liveMatch.result.log.slice(cursor).some((p) => p.play?.command));
  assert.ok(g.liveMatch.timeline.log.filter((p) => p.inning > 1).every((p) => !p.play?.command));
  const prefix = structuredClone(g.liveMatch.result.log);
  const oldAction = inningAction(original, cursor);
  assert.throws(() => e.applyAction(g, oldAction), /타임라인/);
  assert.throws(() => e.applyAction(g, { ...inningAction(g), playbackId: 'other' }), /경기/);
  g = e.applyAction(g, inningAction(g));
  assert.deepEqual(g.liveMatch.result.log.slice(0, prefix.length), prefix);
  assert.equal(g.liveMatch.timeline.log[g.liveMatch.cursor].inning, 3);
  assert.equal(g.liveMatch.inningDelegations.length, 2);
  assert.ok(g.liveMatch.timeline.log.filter((p) => p.inning > 2).every((p) => !p.play?.command));
  const ownCard = g.liveMatch.result.log.find((p) => p.play?.cards?.own)?.play.cards.own;
  assert.ok(ownCard, 'The coach actually consumes a selected one-use card');
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'useMatchCard',
        cardId: ownCard,
        draftId: g.liveMatch.cards.id,
        cursor: g.liveMatch.cursor,
        timelineVersion: g.liveMatch.timelineVersion,
      }),
    /이미 사용/,
  );
  const both = structuredClone(g.liveMatch.result.log);
  const done = e.applyAction(g, { ...inningAction(g), type: 'delegateMatch' });
  assert.deepEqual(done.history[0].log.slice(0, both.length), both);
  assert.equal(done.history.length, 1);
});
test('Delegating innings through the final out finishes once and refuses later alterations', () => {
  let g = e.applyAction(ready(), { type: 'startMatch' });
  for (let i = 0; i < 18 && !g.liveMatch.finished; i++) g = e.applyAction(g, inningAction(g));
  assert.ok(g.liveMatch.finished);
  assert.equal(g.liveMatch.cursor, g.liveMatch.timeline.log.length);
  assert.throws(() => e.applyAction(g, inningAction(g)), /진행 중인 경기/);
  const next = e.applyAction(g, {
    type: 'completeMatch',
    cursor: g.liveMatch.cursor,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  assert.equal(next.history.length, 1);
  assert.equal(next.liveMatch, undefined);
  assert.throws(() => e.applyAction(next, inningAction(g)), /진행 중인 경기/);
});
