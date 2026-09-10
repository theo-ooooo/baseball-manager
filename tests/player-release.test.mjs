import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output = join(tmpdir(), 'dugout-release.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/player-release';export * from './packages/shared/src/club-finance';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
});
const {
  engine: e,
  world,
  releaseCompensation,
  annualPayroll,
} = createRequire(import.meta.url)(output);
const game = () => e.newGame('kbo-lotte', '방출 검증', 'full', 47);
test('Release settles the guarantee once, removes wages and pending renewals, and preserves a free agent identity', () => {
  const g = game(),
    p = g.roster.find((p) => p.squad === 'reserve');
  g.deals = [
    {
      id: 'renewing',
      type: 'renew',
      player: structuredClone(p),
      status: 'pending',
      salary: p.salary,
      years: 3,
      fee: 0,
      agentFee: 0,
      day: g.day,
      message: '',
    },
  ];
  const original = structuredClone(g),
    cost = releaseCompensation(g, p);
  const next = e.applyAction(g, {
    type: 'releasePlayer',
    id: p.id,
    confirm: true,
    compensation: cost,
  });
  assert.equal(next.budget, original.budget - cost);
  assert.equal(next.expenses, original.expenses + cost);
  assert.equal(annualPayroll(original) - annualPayroll(next), p.salary);
  assert.equal(next.ownership[p.id], 'fa');
  assert.ok(!next.roster.some((v) => v.id === p.id));
  assert.ok(!next.deals.some((d) => d.player.id === p.id));
  const fa = e.marketPlayers(next).find((v) => v.id === p.id);
  assert.equal(fa.club, 'fa');
  assert.equal(fa.years, 0);
  assert.deepEqual(fa.stats, p.stats);
  assert.throws(
    () =>
      e.applyAction(next, { type: 'releasePlayer', id: p.id, confirm: true, compensation: cost }),
    /소속/,
  );
  const migrated = structuredClone(next);
  migrated.catalogVersion = 'previous';
  assert.ok(!e.applyAction(migrated, { type: 'syncCatalog' }).roster.some((v) => v.id === p.id));
  assert.deepEqual(g, original);
});
test('Release rejects stale costs, foreign players, unconfirmed actions and live games without mutations', () => {
  const g = game(),
    p = g.roster.find((p) => p.squad === 'reserve'),
    before = structuredClone(g),
    cost = releaseCompensation(g, p);
  for (const a of [
    { id: p.id, compensation: cost },
    { id: p.id, confirm: true, compensation: cost + 1 },
    { id: 'foreign', confirm: true, compensation: 0 },
  ])
    assert.throws(() => e.applyAction(g, { type: 'releasePlayer', ...a }));
  g.day = -22;
  const live = e.applyAction(g, { type: 'startMatch' });
  assert.throws(
    () =>
      e.applyAction(live, { type: 'releasePlayer', id: p.id, confirm: true, compensation: cost }),
    /경기/,
  );
  g.day = before.day;
  assert.deepEqual(g, before);
});
test('Omitted Son Seong-bin is restored once to old saves without undoing a transfer', () => {
  const son = world.players.find((p) => p.name === '손성빈');
  assert.equal(son.club, 'kbo-lotte');
  assert.equal(son.pos, 'C');
  assert.equal(son.number, 28);
  assert.equal(son.portrait.officialId, '51528');
  const g = game();
  g.roster = g.roster.filter((p) => p.id !== son.id);
  g.catalogVersion = 'old';
  const restored = e.applyAction(g, { type: 'syncCatalog' });
  assert.equal(restored.roster.filter((p) => p.id === son.id).length, 1);
  assert.equal(restored.roster.find((p) => p.id === son.id).squad, 'reserve');
  assert.equal(
    e.applyAction(restored, { type: 'syncCatalog' }).roster.filter((p) => p.id === son.id).length,
    1,
  );
  g.ownership[son.id] = 'kbo-lg';
  assert.ok(!e.applyAction(g, { type: 'syncCatalog' }).roster.some((p) => p.id === son.id));
});
