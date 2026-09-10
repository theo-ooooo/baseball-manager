import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['apps/web/src/features/matches/match-commentary.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { matchCommentary, visibleMatchCues } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
function scene(kind, extra = {}) {
  return {
    kind,
    batter: '타자',
    pitcher: '투수',
    event: { text: '완료된 결과', score: [1, 0] },
    play: {
      before: { outs: 0, bases: [null, null, null], score: [0, 0] },
      after: { outs: 0, bases: [null, null, null], score: [1, 0] },
      ...extra,
    },
  };
}
test('commentary withholds final outcomes and cheers until the result reveal boundary', () => {
  const cues = matchCommentary(scene('homeRun'), 'one');
  assert.ok(cues.some((c) => c.sound === 'bat'));
  assert.ok(
    !visibleMatchCues(cues, 0.999).some(
      (c) => c.final || c.sound === 'cheer' || c.text.includes('완료된 결과'),
    ),
  );
  const final = visibleMatchCues(cues, 1).at(-1);
  assert.equal(final.final, true);
  assert.equal(final.sound, 'cheer');
  assert.match(final.text, /1 대 0/);
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
});
test('walks and strikeouts have no bat sound, while steals do not announce a plate appearance', () => {
  for (const kind of ['walk', 'strikeout']) {
    const cues = matchCommentary(scene(kind), kind);
    assert.equal(cues.filter((c) => c.sound === 'bat').length, 0);
    assert.ok(cues.some((c) => c.sound === 'glove'));
  }
  const steal = matchCommentary(scene('out', { plateAppearance: false }), 'steal');
  assert.ok(!steal.some((c) => c.text.includes('타석') || c.sound === 'bat'));
  assert.deepEqual(matchCommentary({ event: undefined }, 'empty'), []);
});
