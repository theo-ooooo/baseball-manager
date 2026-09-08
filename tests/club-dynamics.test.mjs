import { waitForReply } from './helpers/recruitment.mjs';
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
  g = waitForReply(e, g, g.deals[0].id);
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

test('Daily continue saves each idle date and stops for reports even with a full inbox', () => {
  let g = e.newGame('kbo-lotte', 'Calendar', 'full', 8);
  g.day = -20;
  g.news = Array.from({ length: 100 }, (_, i) => ({
    id: `old-${i}`,
    day: -28,
    title: 'Old',
    body: '',
    kind: 'club',
    read: true,
  }));
  const history = structuredClone(g.history);
  g = e.applyAction(g, { type: 'continueDay' });
  assert.equal(g.day, -19);
  assert.equal(g.progress.stop, null);
  while (!g.progress.stop) g = e.applyAction(g, { type: 'continueDay' });
  assert.equal(g.day, -15);
  assert.equal(g.progress.stop, 'fixture');
  assert.deepEqual(g.history, history);
  const atGame = e.applyAction(g, { type: 'continueDay' });
  assert.equal(atGame.day, g.day);
  assert.deepEqual(atGame.history, history);
  g = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  assert.equal(g.day, -14);
  assert.equal(g.progress.stop, 'report');
  assert.ok(
    g.news.some((n) => n.title === '주간 선수단 보고' && g.progress.newsIds.includes(n.id)),
  );
  assert.equal(g.news.length, 100);
});

test('Continue stops on a rest-day report and unresolved decisions cannot be skipped', () => {
  let g = e.newGame('kbo-lotte', 'Reports', 'full', 8);
  g.day = -2;
  g.roster[0].mood.value = 30;
  const original = structuredClone(g);
  g = e.applyAction(g, { type: 'continueDay' });
  assert.equal(g.progress.stop, 'decision');
  assert.equal(g.day, -1);
  const paused = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  assert.equal(paused.day, -1);
  assert.equal(paused.budget, g.budget);
  assert.deepEqual(paused.history, g.history);
  assert.equal(original.day, -2);
  const clean = e.newGame('kbo-lotte', 'Report stop', 'full', 8);
  clean.day = -7;
  clean.roster[0].mood.promise = { due: -6, games: 1, startGames: 0 };
  const stopped = e.applyAction(clean, { type: 'continue' });
  assert.equal(stopped.day, -6);
  assert.equal(stopped.progress.stop, 'report');
  assert.ok(
    stopped.news.some((n) => n.title.includes('불이행') && stopped.progress.newsIds.includes(n.id)),
  );
});
