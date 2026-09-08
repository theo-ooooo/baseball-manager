import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-ratings-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { world, engine: e } = createRequire(import.meta.url)(out);
test('Real-player evidence resolves the right identity and actual counting stats', () => {
  const jeon = world.players.find((p) => p.original === '전민재');
  assert.equal(jeon.rating.record.name, '전민재');
  assert.equal(jeon.rating.record.pa, 369);
  assert.equal(jeon.rating.record.hr, 5);
  const kim = world.players.find((p) => p.original === '김도영');
  assert.equal(kim.rating.record.name, '김도영');
  assert.notEqual(kim.power, jeon.power);
  for (const p of world.players.filter((p) => p.real)) {
    assert.ok(p.rating);
    if (p.rating.status === 'missing') {
      assert.equal(e.overall(p), 50);
      assert.equal(p.potential, 50);
    } else assert.ok(p.rating.record && p.rating.record.season === 2025);
  }
});
test('Career rating upgrade is idempotent and preserves contracts, development, transfers and match stats', () => {
  let g = e.newGame('kbo-lotte', 'Ratings', 'short', 9);
  const p = g.roster.find((p) => p.original === '전민재');
  p.salary = 431;
  p.years = 5;
  p.stats.ab = 77;
  p.rating = undefined;
  p.contact = 99;
  g.catalogVersion = 'old';
  g = e.applyAction(g, { type: 'syncCatalog' });
  const current = g.roster.find((x) => x.id === p.id);
  assert.equal(current.contact, world.players.find((x) => x.id === p.id).contact);
  assert.equal(current.salary, 431);
  assert.equal(current.years, 5);
  assert.equal(current.stats.ab, 77);
  current.contact += 0.5;
  assert.deepEqual(e.applyAction(g, { type: 'syncCatalog' }), g);
});
