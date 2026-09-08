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
const { world, engine: e, detailedAttributes, lineupReason } = createRequire(import.meta.url)(out);
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

test('v1-to-v2 upgrade retains growth and transferred ownership across roster, offers and sold players', () => {
  let g = e.newGame('kbo-lotte', 'Existing career', 'short', 9);
  const playerId = g.roster.find((p) => p.original === '전민재').id;
  g = e.negotiate(g, playerId, 431, 5, 'renew');
  const sold = g.roster.find((p) => p.real && p.id !== playerId && !g.lineup.includes(p.id));
  g.roster = g.roster.filter((p) => p.id !== sold.id);
  sold.club = 'kbo-lg';
  g.transferred.push(sold);
  g.ownership[sold.id] = 'kbo-lg';
  const player = g.roster.find((p) => p.id === playerId);
  player.salary = 431;
  player.years = 5;
  player.stats.ab = 77;
  for (const p of [player, sold, g.deals[0].player]) {
    p.rating.version = 'performance-2025-v1';
    p.rating.base.contact = 70;
    p.contact = 71.5;
  }
  const budget = g.budget;
  g.catalogVersion = 'world-2026-09-08-v5';
  const upgraded = e.applyAction(g, { type: 'syncCatalog' });
  for (const p of [
    upgraded.roster.find((p) => p.id === playerId),
    upgraded.transferred.find((p) => p.id === sold.id),
    upgraded.deals[0].player,
  ]) {
    assert.equal(p.rating.version, 'performance-2025-v2');
    assert.equal(p.contact, world.players.find((base) => base.id === p.id).contact + 1.5);
  }
  const current = upgraded.roster.find((p) => p.id === playerId);
  assert.equal(current.salary, 431);
  assert.equal(current.years, 5);
  assert.equal(current.stats.ab, 77);
  assert.equal(upgraded.budget, budget);
  assert.equal(upgraded.ownership[sold.id], 'kbo-lg');
  assert.equal(upgraded.transferred.find((p) => p.id === sold.id).club, 'kbo-lg');
  assert.ok(!upgraded.roster.some((p) => p.id === sold.id));
  assert.deepEqual(e.applyAction(upgraded, { type: 'syncCatalog' }), upgraded);
});

test('Observed attributes remain distinct from missing measurements and lineup roles use different strengths', () => {
  const yoo = world.players.find((p) => p.original === '유강남');
  const attributes = detailedAttributes(yoo);
  assert.ok(attributes.find((a) => a.label === '출루').value > 65);
  assert.equal(attributes.find((a) => a.label === '수비').value, null);
  assert.equal(attributes.find((a) => a.label === '송구').value, null);
  assert.equal(attributes.find((a) => a.label === '도루 판단').value, null);
  const generated = world.players.find((p) => !p.real && p.pos === 'C');
  assert.ok(detailedAttributes(generated).every((a) => Number.isFinite(a.value)));
  const positions = ['C', 'IF', 'IF', 'IF', 'IF', 'OF', 'OF', 'OF', 'DH'];
  const roster = positions.map((pos, i) => ({
    ...structuredClone(generated),
    id: 'role-' + i,
    pos,
    contact: 60,
    power: 60,
    speed: 60,
    condition: 100,
  }));
  roster[5].contact = 85;
  roster[5].speed = 90;
  roster[8].power = 99;
  roster[8].contact = 80;
  roster[8].speed = 40;
  const lineup = e.lineupAuto(roster);
  assert.equal(lineup[0], roster[5].id, 'On-base and running strength leads off');
  assert.equal(lineup[3], roster[8].id, 'The strongest slugger bats fourth');
  assert.equal(new Set(lineup).size, 9);
  assert.match(lineupReason(yoo, 0), /OBP 0\.352/);
});
