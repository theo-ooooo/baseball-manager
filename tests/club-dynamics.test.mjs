import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-dynamics-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine: e } = createRequire(import.meta.url)(out);
test('A selling club protects its core player even when the agent salary offer is high', () => {
  let g = e.newGame('kbo-lotte', 'Transfer', 'full', 8);
  while (g.phase === 'preseason') g = e.advance(g, 7);
  const target = e
    .marketPlayers(g)
    .filter((p) => p.club === 'kbo-lg')
    .sort((a, b) => e.overall(b) - e.overall(a))[0];
  g.budget = 1e8;
  g = e.negotiate(g, target.id, 1e5, 3);
  assert.equal(g.deals[0].seller.status, 'refused');
  assert.equal(g.deals[0].status, 'rejected');
  assert.throws(() => e.signDeal(g, g.deals[0].id));
});
test('Outgoing sale requires a live buyer offer; forged and expired offers cannot move money or a player', () => {
  let g = e.newGame('mlb-dodgers', 'Transfer', 'short', 7);
  const p = g.roster.find((p) => p.squad === 'reserve' && !p.real);
  assert.throws(() => e.applyAction(g, { type: 'sell', id: p.id, offerId: 'forged' }), /제안/);
  g = e.applyAction(g, { type: 'listPlayer', id: p.id });
  g = e.advance(g, 3);
  const o = g.saleOffers.find((o) => o.playerId === p.id);
  assert.ok(o);
  const before = g.budget;
  const expired = structuredClone(g);
  expired.day = o.expires + 1;
  assert.throws(() => e.sellPlayer(expired, p.id, o.id), /제안/);
  g = e.applyAction(g, { type: 'sell', id: p.id, offerId: o.id });
  assert.equal(g.budget, before + o.fee);
  assert.equal(g.ownership[p.id], o.club);
  assert.throws(() => e.applyAction(g, { type: 'sell', id: p.id, offerId: o.id }));
});
test('Morale concern produces a persistent inbox decision, tracks promises and penalizes breaking them', () => {
  let g = e.newGame('kbo-lotte', 'Manager', 'short', 12);
  const p = g.roster.find((p) => p.squad === 'reserve' && p.pos !== 'P');
  p.mood.value = 30;
  p.mood.reason = '출전 부족';
  g = e.advance(g, 7);
  assert.equal(g.day, -27);
  const n = g.news.find((n) => n.playerId === p.id && n.choiceKind);
  assert.ok(n);
  g = e.applyAction(g, { type: 'respondNews', id: n.id, choice: 'promise' });
  assert.ok(g.roster.find((x) => x.id === p.id).mood.promise);
  assert.throws(() => e.applyAction(g, { type: 'respondNews', id: n.id, choice: 'promise' }));
  const before = g.roster.find((x) => x.id === p.id).mood.value;
  for (let i = 0; i < 14; i++) g = e.advance(g, 1);
  const current = g.roster.find((x) => x.id === p.id);
  assert.ok(!current.mood.promise);
  assert.ok(current.mood.value < before);
  assert.ok(g.news.some((n) => n.title.includes('불이행')));
  g = e.applyAction(g, { type: 'readAllNews' });
  assert.ok(g.news.every((n) => n.read));
});
test('Continue skips idle dates and stops before the next game', () => {
  let g = e.newGame('kbo-lotte', 'Continue', 'full', 8);
  g = e.applyAction(g, { type: 'continue' });
  assert.equal(g.day, -22);
  assert.equal(g.history.length, 0);
  g = e.applyAction(g, { type: 'continue' });
  assert.equal(g.history.length, 1);
  assert.ok(g.history[0].friendly);
});
