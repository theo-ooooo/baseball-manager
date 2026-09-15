import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-trade-recommendations.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/trades';export * from './apps/api/src/domain/trade-recommendations';export * from './apps/api/src/domain/deadline-market';export * from './packages/shared/src/trade-policy';export * from './packages/shared/src/trade-status';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  world,
  recommendTrades,
  createTrades,
  createDeadlineMarket,
  assessTradeReturn,
  playerClubStanding,
  tradeCanRevise,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', '협상 감독', 'short', 434);
const proposal = (s) => ({
  type: 'proposeTrade',
  club: s.club,
  incoming: s.incoming.map((p) => p.id),
  outgoing: s.outgoing.map((p) => p.id),
  cash: s.cash,
});
function counter() {
  let g = game();
  const s = recommendTrades(g, world, {})[0];
  assert.ok(s);
  g = e.applyAction(g, { ...proposal(s), cash: s.cash - 1000 });
  g.day += 2;
  createTrades(world).tick(g);
  assert.equal(g.trades[0].status, 'counter');
  return g;
}
test('Recommendations are bounded, deterministic, read-only and valid for both real rosters and budget', () => {
  const g = game(),
    before = structuredClone(g),
    start = performance.now(),
    suggestions = recommendTrades(g, world, {});
  console.info(
    `Trade recommendation search: ${(performance.now() - start).toFixed(1)} ms, ${suggestions.length} offers`,
  );
  assert.ok(suggestions.length > 0 && suggestions.length <= 3);
  assert.deepEqual(g, before);
  assert.deepEqual(recommendTrades(g, world, {}), suggestions);
  for (const s of suggestions) {
    const { own, other } = createTrades(world).validate(g, proposal(s));
    assert.equal(assessTradeReturn(e.rosterFor(g, s.club), own, other, s.cash).status, 'accepted');
    assert.ok(
      own.every((p) => !['franchise', 'core'].includes(playerClubStanding(p, g.roster).tier)),
    );
    assert.ok(s.outgoing.every((p) => !('potential' in p)));
  }
});
test('Selected target recommendations offer real alternatives, omit reserved players and preserve the ongoing offer', () => {
  let g = counter(),
    o = g.trades[0];
  const before = structuredClone(g),
    s = recommendTrades(g, world, { club: o.club, incoming: o.incoming, offerId: o.id });
  assert.ok(s.length);
  assert.deepEqual(recommendTrades(g, world, { offerId: o.id }), s);
  assert.deepEqual(g, before);
  assert.ok(s.every((r) => r.incoming.map((p) => p.id).join() === o.incoming.join()));
  g.trades.push({
    ...o,
    id: 'another-trade',
    outgoing: [s[0].outgoing[0].id],
    incoming: [],
    counterOutgoing: undefined,
    status: 'pending',
  });
  const r = recommendTrades(g, world, { club: o.club, incoming: o.incoming, offerId: o.id });
  assert.ok(r.every((s) => !s.outgoing.some((p) => p.id === g.trades[1].outgoing[0])));
});
test('Counter to counter to acceptance keeps one trade, prior terms and deadline; roster and cash move only on confirmation', () => {
  let g = counter();
  const id = g.trades[0].id,
    expiry = g.trades[0].expires,
    beforeRoster = g.roster.map((p) => p.id),
    beforeBudget = g.budget;
  for (let i = 2; i <= 9; i++) {
    const o = g.trades[0];
    g = e.applyAction(g, {
      type: 'reviseTrade',
      id,
      incoming: o.counterIncoming || o.incoming,
      outgoing: o.counterOutgoing || o.outgoing,
      cash: o.counterCash - 1,
    });
    assert.equal(g.trades.length, 1);
    assert.equal(g.trades[0].round, i);
    assert.equal(g.trades[0].status, 'counter');
    assert.equal(g.trades[0].expires, expiry);
    assert.equal(g.budget, beforeBudget);
    assert.deepEqual(
      g.roster.map((p) => p.id),
      beforeRoster,
    );
  }
  assert.equal(g.trades[0].history.length, 6);
  assert.equal(g.trades[0].history[0].round, 3);
  assert.equal(g.trades[0].history[0].status, 'counter');
  assert.equal(
    new Set(g.news.filter((n) => n.tradeId === id).map((n) => n.id)).size,
    g.news.filter((n) => n.tradeId === id).length,
  );
  const current = g.trades[0];
  g = e.applyAction(g, {
    type: 'reviseTrade',
    id,
    outgoing: current.counterOutgoing || current.outgoing,
    incoming: current.counterIncoming || current.incoming,
    cash: current.counterCash,
  });
  assert.equal(g.trades[0].status, 'accepted');
  const cost = g.trades[0].cash;
  g = e.applyAction(g, { type: 'acceptTrade', id });
  assert.equal(g.budget, beforeBudget - cost);
  assert.equal(g.trades[0].status, 'completed');
  assert.throws(() =>
    e.applyAction(g, { type: 'reviseTrade', id, outgoing: current.outgoing, cash: 0 }),
  );
});
test('General renegotiation cannot extend deadlines, steal a reserved incoming player or resurrect a withdrawal', () => {
  let g = counter(),
    o = g.trades[0];
  g.trades.push({
    ...o,
    id: 'reserved',
    incoming: [e.rosterFor(g, o.club).find((p) => !o.incoming.includes(p.id)).id],
    outgoing: [],
    counterOutgoing: undefined,
    counterIncoming: undefined,
    status: 'pending',
  });
  assert.throws(() =>
    e.applyAction(g, {
      type: 'reviseTrade',
      id: o.id,
      incoming: g.trades[1].incoming,
      outgoing: o.counterOutgoing || o.outgoing,
      cash: 1000,
    }),
  );
  g.trades.pop();
  g.day += 30;
  assert.equal(tradeCanRevise(g, o), false);
  assert.throws(() =>
    e.applyAction(g, { type: 'reviseTrade', id: o.id, outgoing: o.outgoing, cash: 0 }),
  );
  g = counter();
  o = g.trades[0];
  g = e.applyAction(g, { type: 'withdrawTrade', id: o.id });
  assert.throws(() =>
    e.applyAction(g, { type: 'reviseTrade', id: o.id, outgoing: o.outgoing, cash: 0 }),
  );
});
test('Recommendation endpoint domain rejects foreign offers, invalid targets and unavailable phases', () => {
  const g = game();
  assert.throws(() => recommendTrades(g, world, { offerId: 'not-ours' }));
  assert.throws(() => recommendTrades(g, world, { club: g.club }));
  assert.throws(() => recommendTrades(g, world, { incoming: ['foreign'] }));
  assert.throws(() => recommendTrades(g, world, { incoming: ['x', 'x'] }));
  g.liveMatch = {};
  assert.throws(() => recommendTrades(g, world, {}));
  delete g.liveMatch;
  g.managerCareer.status = 'unemployed';
  assert.throws(() => recommendTrades(g, world, {}));
});
test('Deadline recommendations clear rival terms and generic revision keeps the original target fixed', () => {
  let g = game();
  g.phase = 'regular';
  g.day = Math.floor(g.rounds * 0.8) - 7;
  createDeadlineMarket(world).prepare(g);
  const l = g.deadlineMarket.listings[0];
  assert.ok(l);
  const choices = recommendTrades(g, world, { club: l.seller, incoming: [l.player.id] });
  assert.ok(choices.length);
  g = e.applyAction(g, proposal(choices[0]));
  const o = g.trades[0];
  assert.ok(o.deadline.leading);
  g = e.applyAction(g, {
    type: 'reviseTrade',
    id: o.id,
    outgoing: o.outgoing,
    incoming: o.incoming,
    cash: o.cash,
  });
  assert.equal(g.trades[0].deadline.round, 2);
  assert.equal(g.trades[0].id, o.id);
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'reviseTrade',
        id: o.id,
        incoming: [
          e.rosterFor(g, o.club).find((p) => p.id !== l.player.id && p.pos === l.player.pos).id,
        ],
        outgoing: o.outgoing,
        cash: o.cash,
      }),
    /대상 선수/,
  );
});
