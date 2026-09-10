import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output = join(tmpdir(), 'dugout-match-decisions.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './packages/shared/src/match-decision';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
});
const { engine: e, matchDecision } = createRequire(import.meta.url)(output);
function ready() {
  const g = e.newGame('kbo-lotte', '대타 회귀 검증', 'full', 16);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch' });
}

test('Two outs, first and second: Jeon Jun-woo can be pinch-hit before his precomputed inning-ending out', () => {
  const g = ready(),
    l = g.liveMatch,
    own = l.home === g.club ? 1 : 0;
  const cursor = l.timeline.log.findIndex(
    (ev) =>
      ev.half === own &&
      ev.play?.before.outs === 2 &&
      ev.play.after.outs === 3 &&
      ev.play.before.bases[0] &&
      ev.play.before.bases[1] &&
      !ev.play.before.bases[2] &&
      g.roster.find((p) => p.id === ev.play.batter)?.name === '전준우',
  );
  assert.ok(cursor > 0, 'The exact reported inning-ending scenario exists');
  const d = matchDecision(l, g.club, cursor);
  assert.equal(d.kind, 'opportunity');
  assert.equal(d.batter, '전준우');
  assert.equal(d.outs, 2);
  const before = structuredClone(l.timeline.log.slice(0, cursor));
  const incoming = g.roster.find(
    (p) => p.squad !== 'reserve' && p.pos !== 'P' && !g.lineup.includes(p.id),
  );
  const lineup = [...g.lineup];
  lineup[d.slot] = incoming.id;
  const defense = Object.fromEntries(
    Object.entries(g.defense).map(([pos, id]) => [pos, id === d.batterId ? incoming.id : id]),
  );
  const pitcher =
    before.filter((ev) => ev.half !== own && ev.play).at(-1)?.play.pitcher || g.starter;
  defense.P = pitcher;
  const revised = e.applyAction(g, {
    type: 'reviseMatch',
    cursor,
    timelineVersion: l.timelineVersion,
    lineup,
    defense,
    pitcher,
    instructions: g.instructions,
  });
  assert.deepEqual(revised.liveMatch.timeline.log.slice(0, cursor), before);
  assert.equal(revised.liveMatch.cursor, cursor);
  assert.equal(revised.liveMatch.result.log.length, cursor);
  assert.equal(revised.liveMatch.result.log.at(-1).play.after.outs, 2);
  assert.equal(revised.liveMatch.timeline.log[cursor].play.batter, incoming.id);
  assert.equal(matchDecision(revised.liveMatch, g.club, cursor).batterId, incoming.id);
});

test('Decision state uses only consumed data, detects both sides, and clears bases on the third out', () => {
  const g = ready(),
    l = g.liveMatch;
  for (let cursor = 1; cursor < l.timeline.log.length; cursor++) {
    const d = matchDecision(l, g.club, cursor),
      ev = l.timeline.log[cursor - 1];
    if (ev.play?.after.outs === 3) {
      assert.equal(d.kind, null);
      assert.equal(d.outs, 0);
      assert.ok(d.bases.every((id) => !id));
    }
    if (d.kind) assert.equal(d.kind, d.attacking ? 'opportunity' : 'threat');
    const changed = {
      ...l,
      timeline: {
        ...l.timeline,
        log: [
          ...l.timeline.log.slice(0, cursor),
          ...l.timeline.log
            .slice(cursor)
            .map(() => ({ inning: 99, half: 1, text: '미래 비공개', score: [999, 999] })),
        ],
      },
    };
    assert.deepEqual(matchDecision(changed, g.club, cursor), d);
  }
  assert.equal(matchDecision(l, g.club, l.timeline.log.length).kind, null);
});
