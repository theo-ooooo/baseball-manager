import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-player-lifecycle.cjs');
buildSync({
  entryPoints: ['tests/fixtures/player-lifecycle.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  world,
  createWorldSimulation,
  prepareSquad,
  playerRetires,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', '계약 감독', 'short', 771);

test('Published multi-year contracts retain their end season at career start', () => {
  const g = game();
  assert.equal(g.roster.find((p) => p.name === '전준우').years, 2);
  assert.equal(g.roster.find((p) => p.name === '박세웅').years, 2);
  assert.equal(g.roster.find((p) => p.name === '김원중').years, 3);
  assert.equal(world.players.find((p) => p.name === '류현진').years, 6);
  assert.equal(world.players.find((p) => p.original === 'Jung Hoo Lee').years, 4);
  assert.equal(world.players.find((p) => p.original === 'Shohei Ohtani').years, 8);
  assert.equal(world.players.find((p) => p.original === 'Yoshinobu Yamamoto').years, 10);
});

test('Catalog upgrades repair untouched contracts while preserving negotiated contracts and released players', () => {
  const g = game();
  const p = g.roster.find((p) => p.name === '전준우');
  g.catalogVersion = 'old';
  p.years = 1;
  g.ownership[p.id] = g.club; // An appointment records ownership without signing new player terms.
  prepareSquad(g, world);
  assert.equal(p.years, 2);
  p.years = 5;
  p.contractSigned = { year: g.year, day: 0, dealId: 'signed' };
  g.catalogVersion = 'old';
  prepareSquad(g, world);
  assert.equal(p.years, 5);
  delete p.contractSigned;
  p.club = 'fa';
  p.years = 1;
  g.transferred.push(p);
  g.roster = g.roster.filter((v) => v.id !== p.id);
  g.ownership[p.id] = 'fa';
  g.catalogVersion = 'old';
  prepareSquad(g, world);
  assert.equal(p.club, 'fa');
  assert.equal(p.years, 1);
  assert.ok(!g.roster.some((v) => v.id === p.id));
});

test('An AI snapshot upgrade repairs an initial contract and preserves a later AI renewal', () => {
  const g = game(),
    sim = createWorldSimulation(world);
  const lee = e.rosterFor(g, 'mlb-giants').find((p) => p.original === 'Jung Hoo Lee');
  lee.years = 1;
  sim.commit(g, lee);
  g.catalogVersion = 'old';
  prepareSquad(g, world);
  assert.equal(e.rosterFor(g, 'mlb-giants').find((p) => p.id === lee.id).years, 4);
  const renewed = e.rosterFor(g, 'mlb-giants').find((p) => p.id === lee.id);
  renewed.years = 5;
  renewed.contractSigned = { year: g.year, day: 0, dealId: 'ai-new' };
  sim.commit(g, renewed);
  g.catalogVersion = 'old';
  prepareSquad(g, world);
  assert.equal(e.rosterFor(g, 'mlb-giants').find((p) => p.id === lee.id).years, 5);
});

test('Veterans with remaining contracts or useful playing contributions are not retired purely by age', () => {
  const p = game().roster[0];
  for (const key of ['contact', 'power', 'speed', 'field', 'stuff', 'control']) p[key] = 75;
  for (let i = 0; i < 500; i++) {
    p.id = 'veteran-' + i;
    p.age = 44;
    p.years = 3;
    assert.equal(playerRetires(p, 2026), false);
    p.age = 39;
    p.years = 1;
    p.stats.ab = 100;
    p.stats.outs = 100;
    assert.equal(playerRetires(p, 2026), false);
  }
  p.age = 45;
  p.years = 1;
  assert.equal(playerRetires(p, 2026), true);
});

test('Season close preserves a contracted veteran, renews AI contracts and archives only real retirement decisions', () => {
  const g = game(),
    sim = createWorldSimulation(world);
  const veteran = g.roster.find((p) => p.name === '전준우');
  veteran.age = 41;
  veteran.years = 2;
  const ai = e.rosterFor(g, 'kbo-lg').find((p) => p.age < 30);
  ai.years = 1;
  sim.commit(g, ai);
  const long = e.rosterFor(g, 'kbo-lg').find((p) => p.id !== ai.id && p.age < 30);
  long.years = 4;
  sim.commit(g, long);
  sim.finishSeason(g);
  assert.ok(g.roster.some((p) => p.id === veteran.id));
  assert.ok(!g.pendingRecords.some((r) => r.playerId === veteran.id && r.kind === 'retirement'));
  const renewed = e.rosterFor(g, 'kbo-lg').find((p) => p.id === ai.id);
  assert.ok(renewed.years >= 2);
  assert.ok(renewed.contractSigned.dealId.startsWith('ai-renew-'));
  assert.equal(e.rosterFor(g, 'kbo-lg').find((p) => p.id === long.id).years, 3);
  const before = g.pendingRecords.length;
  sim.finishSeason(g);
  assert.equal(g.pendingRecords.length, before);
});
