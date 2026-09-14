import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const outfile = join(tmpdir(), 'dugout-command-results.cjs');
buildSync({
  stdin: {
    contents: "export * from './apps/web/src/features/matches/match-command-results';",
    resolveDir: process.cwd(),
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { matchCommandResults } = createRequire(import.meta.url)(outfile);
const event = (command, text, half = 0, before = {}, after = {}, extra = {}) => ({
  inning: 8,
  half,
  text,
  score: [0, 0],
  play: {
    command,
    batter: 'b',
    pitcher: 'p',
    before: { outs: 0, score: [0, 0], bases: ['r', null, null], ...before },
    after: { outs: 0, score: [0, 0], bases: ['b', null, 'r'], ...after },
    ...extra,
  },
});
const result = (...log) => ({ id: 'match', away: 'own', home: 'other', log });
test('Only completed commanded plays appear; hit size and tactical success are distinct', () => {
  const r = result(
    event('contactFocus', '안타'),
    event('swingAway', '2루타'),
    event('swingAway', '홈런', 0, {}, { score: [2, 0], bases: [null, null, null] }),
  );
  assert.deepEqual(matchCommandResults(r, 0, 'own'), []);
  assert.deepEqual(
    matchCommandResults(r, 2, 'own').map((e) => e.label),
    ['1루타!', '2루타!'],
  );
  assert.ok(matchCommandResults(r, 2, 'own').every((e) => e.success));
  assert.equal(matchCommandResults(r, 3, 'own')[2].label, '홈런!!');
  assert.equal(matchCommandResults(result(event('swingAway', '안타')), 1, 'own')[0].success, false);
  assert.deepEqual(matchCommandResults(result(event(undefined, '홈런')), 1, 'own'), []);
  assert.deepEqual(matchCommandResults({ ...r, delegatedBy: '코치' }, 3, 'own'), []);
  assert.equal(matchCommandResults(r, 3, 'own', [{ cursor: 1, kind: 'swingAway' }]).length, 1);
});
test('Pitching signs celebrate outs without runs and do not claim intentional walks prevent a crisis', () => {
  assert.equal(
    matchCommandResults(result(event('pitchAround', '볼넷', 1)), 1, 'own')[0].label,
    '볼넷 허용',
  );
  assert.equal(
    matchCommandResults(
      result(event('attackBatter', '삼진', 1, { outs: 2 }, { outs: 3 })),
      1,
      'own',
    )[0].success,
    true,
  );
  assert.equal(
    matchCommandResults(
      result(event('induceGrounder', '희생 타점', 1, {}, { outs: 1, score: [0, 1] })),
      1,
      'own',
    )[0].success,
    false,
  );
  assert.equal(
    matchCommandResults(result(event('intentionalWalk', '고의4구', 1)), 1, 'own')[0].success,
    false,
  );
  assert.deepEqual(matchCommandResults(result(event('attackBatter', '삼진', 0)), 1, 'own'), []);
});
test('Steals and sacrifice bunts require the actual safe or advancing result', () => {
  for (const safe of [true, false])
    assert.equal(
      matchCommandResults(
        result(
          event(
            'stealSecond',
            '도루',
            0,
            {},
            {},
            { plateAppearance: false, steal: { safe, to: 2, runner: 'r' } },
          ),
        ),
        1,
        'own',
      )[0].success,
      safe,
    );
  assert.equal(
    matchCommandResults(
      result(event('bunt', '희생번트 성공', 0, {}, { outs: 1, bases: [null, 'r', null] })),
      1,
      'own',
    )[0].success,
    true,
  );
  assert.equal(
    matchCommandResults(
      result(event('bunt', '번트 실패 · 삼진', 0, {}, { outs: 1, bases: ['r', null, null] })),
      1,
      'own',
    )[0].success,
    false,
  );
});
