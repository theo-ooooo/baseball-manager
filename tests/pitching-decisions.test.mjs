import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const file = join(tmpdir(), 'dugout-pitching-decisions.cjs');
buildSync({
  entryPoints: ['apps/api/src/domain/pitching-decisions.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: file,
});
const { pitchingDecisions } = createRequire(import.meta.url)(file);
const appearance = (id, outs, entryLead = 2, runs = 0, keptLead = true) => ({
  id,
  outs,
  entryLead,
  runs,
  keptLead,
});
test('Starter win, setup hold and closer save are separate decisions', () => {
  const awards = pitchingDecisions(
    [appearance('starter', 18, 0), appearance('setup', 6), appearance('closer', 3)],
    'starter',
    'starter',
    true,
  );
  assert.deepEqual(awards, { winner: 'starter', save: 'closer', holds: ['setup'] });
});
test('Walkoff winner cannot earn a save and a short starter cannot earn a win', () => {
  assert.deepEqual(
    pitchingDecisions(
      [appearance('starter', 18, 0), appearance('closer', 3, 0)],
      'starter',
      'closer',
      true,
    ),
    { winner: 'closer', save: '', holds: [] },
  );
  const short = pitchingDecisions(
    [appearance('starter', 12, 0), appearance('long', 9), appearance('closer', 6)],
    'starter',
    'starter',
    true,
  );
  assert.equal(short.winner, 'long');
  assert.equal(short.save, 'closer');
  assert.deepEqual(short.holds, []);
  const blown = pitchingDecisions(
    [appearance('starter', 18, 0), appearance('closer', 3, 2, 2, false)],
    'starter',
    'closer',
    true,
  );
  assert.equal(blown.winner, 'closer');
  assert.equal(blown.save, '');
});
