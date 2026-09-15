import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-deadline-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/deadline-market';export * from './apps/api/src/domain/trades';export * from './apps/api/src/domain/transfer-market';export * from './packages/shared/src/calendar';export * from './packages/shared/src/trade-window';export * from './packages/shared/src/trade-policy';export * from './packages/shared/src/deadline-market';export * from './packages/shared/src/long-term';",
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
  createDeadlineMarket,
  createTrades,
  createTransferMarket,
  gameDate,
  daysBetween,
  tradeWindow,
  assessTradeReturn,
  tradePackageValue,
  packStats,
} = createRequire(import.meta.url)(out);
function game(club = 'kbo-lotte') {
  const g = e.newGame(club, '마감 감독', 'short', 34, { preseason: false });
  g.day = Math.floor(g.rounds * 0.8) - 7;
  g.news = [];
  g.weather.seed = 0;
  return g;
}
function opened() {
  const g = game();
  createDeadlineMarket(world).prepare(g);
  assert.ok(g.deadlineMarket.listings.length);
  return g;
}
function bid(g, l, p, cash = 1000, extra = {}) {
  return e.applyAction(g, {
    type: 'proposeTrade',
    club: l.seller,
    incoming: [l.player.id],
    outgoing: [p.id],
    cash,
    deadlineId: l.id,
    ...extra,
  });
}
function winning(g, l = g.deadlineMarket.listings[0]) {
  for (const p of g.roster
    .filter((p) => p.pos === l.player.pos)
    .sort((a, b) => e.overall(b) - e.overall(a))) {
    try {
      const next = bid(g, l, p);
      if (next.trades[0].deadline?.leading) return next;
    } catch {}
  }
  assert.fail('Expected an affordable legal winning package');
}
test('Deadline listings appear once near the cutoff, use valid real opposing rosters and remain stable across reloads', () => {
  const early = game();
  early.day = 0;
  createDeadlineMarket(world).prepare(early);
  assert.equal(early.deadlineMarket, undefined);
  const g = opened(),
    saved = structuredClone(g);
  createDeadlineMarket(world).prepare(g);
  assert.deepEqual(g, saved);
  createDeadlineMarket(world).prepare(JSON.parse(JSON.stringify(g)));
  assert.ok(g.deadlineMarket.listings.length <= 3);
  const used = new Set();
  for (const l of g.deadlineMarket.listings) {
    const sellers = e.rosterFor(g, l.seller),
      buyers = e.rosterFor(g, l.rival.club),
      target = sellers.find((p) => p.id === l.player.id),
      returning = buyers.find((p) => p.id === l.rival.player.id);
    assert.ok(target && returning);
    assert.notEqual(l.rival.club, g.club);
    assert.notEqual(l.seller, l.rival.club);
    assert.equal(target.pos, returning.pos);
    assert.equal(
      assessTradeReturn(sellers, [returning], [target], l.rival.cash).status,
      'accepted',
    );
    assert.ok(l.closes <= tradeWindow(g, 'kbo').date);
    for (const id of [target.id, returning.id]) {
      assert.ok(!used.has(id));
      used.add(id);
    }
  }
  assert.equal(g.news.filter((n) => n.id.startsWith('deadline-open:')).length, 1);
});
test('The same generation rules support other countries and skip preseason, vacations and transfer-banned careers', () => {
  const mlb = game('mlb-dodgers');
  createDeadlineMarket(world).prepare(mlb);
  assert.ok(mlb.deadlineMarket.listings.length);
  assert.ok(
    mlb.deadlineMarket.listings.every(
      (l) => e.getClub(l.seller).league === 'mlb' && e.getClub(l.rival.club).league === 'mlb',
    ),
  );
  for (const mode of ['preseason', 'vacation', 'ban']) {
    const g = game();
    if (mode === 'preseason') g.phase = 'preseason';
    if (mode === 'vacation') g.managerCareer.vacationUntil = '2026-12-31';
    if (mode === 'ban') g.rules.firstSeasonTransferBan = true;
    createDeadlineMarket(world).prepare(g);
    assert.equal(g.deadlineMarket, undefined, mode);
  }
});
test('A winning bid is reviewed immediately without moving players; final confirmation alone changes both rosters and cancels the rival transfer', () => {
  const g = opened(),
    l = g.deadlineMarket.listings[0],
    proposed = winning(g, l);
  assert.deepEqual(proposed.roster, g.roster);
  assert.equal(proposed.budget, g.budget);
  assert.equal(proposed.day, g.day);
  assert.ok(proposed.trades[0].deadline.leading);
  assert.equal(proposed.trades[0].due, gameDate(g));
  const offer = proposed.trades[0],
    target = e.rosterFor(proposed, l.seller).find((p) => p.id === l.player.id),
    rivalPlayer = l.rival.player.id;
  const completed = e.applyAction(proposed, { type: 'acceptTrade', id: offer.id });
  assert.ok(completed.roster.some((p) => p.id === target.id));
  assert.equal(completed.roster.find((p) => p.id === target.id).salary, target.salary);
  assert.deepEqual(completed.roster.find((p) => p.id === target.id).stats, target.stats);
  assert.equal(completed.deadlineMarket.listings[0].status, 'won');
  assert.throws(() => e.applyAction(completed, { type: 'acceptTrade', id: offer.id }));
  completed.day += daysBetween(gameDate(completed), l.closes);
  createTrades(world).tick(completed);
  assert.ok(completed.roster.some((p) => p.id === target.id));
  assert.ok(e.rosterFor(completed, l.rival.club).some((p) => p.id === rivalPlayer));
  assert.ok(!e.rosterFor(completed, l.rival.club).some((p) => p.id === target.id));
});
test('Passing the announced decision date executes the actual rival trade once, preserving contracts and the user roster and budget', () => {
  const g = opened();
  g.deadlineMarket.listings = g.deadlineMarket.listings.slice(0, 1);
  const l = g.deadlineMarket.listings[0],
    before = structuredClone(g),
    target = e.rosterFor(g, l.seller).find((p) => p.id === l.player.id),
    returning = e.rosterFor(g, l.rival.club).find((p) => p.id === l.rival.player.id);
  g.day += daysBetween(gameDate(g), l.closes);
  createTrades(world).tick(g);
  assert.equal(l.status, 'lost');
  assert.deepEqual(g.roster, before.roster);
  assert.equal(g.budget, before.budget);
  const moved = e.rosterFor(g, l.rival.club).find((p) => p.id === target.id),
    exchanged = e.rosterFor(g, l.seller).find((p) => p.id === returning.id);
  assert.ok(moved && exchanged);
  assert.equal(moved.salary, target.salary);
  assert.equal(exchanged.years, returning.years);
  assert.deepEqual(packStats(moved.stats), packStats(target.stats));
  assert.ok(!e.rosterFor(g, l.seller).some((p) => p.id === target.id));
  assert.ok(!e.rosterFor(g, l.rival.club).some((p) => p.id === returning.id));
  const saved = structuredClone(g);
  createTrades(world).tick(g);
  assert.deepEqual(g, saved);
  assert.equal(new Set(e.marketPlayers(g).map((p) => p.id)).size, e.marketPlayers(g).length);
  assert.equal(
    g.pendingRecords.filter(
      (r) => [target.id, returning.id].includes(r.playerId) && r.kind === 'transfer',
    ).length,
    2,
  );
});
test('A weaker proposal cannot jump the competition, and revised terms preserve the original offer identity', () => {
  const g = opened();
  let proposed;
  for (const l of g.deadlineMarket.listings) {
    for (const p of g.roster.filter((p) => p.pos === l.player.pos)) {
      try {
        const next = bid(g, l, p, 0);
        if (!next.trades[0].deadline.leading) {
          proposed = next;
          break;
        }
      } catch {}
    }
    if (proposed) break;
  }
  assert.ok(proposed, 'At least one lower offer must need improvement');
  const offer = proposed.trades[0],
    l = proposed.deadlineMarket.listings.find((l) => l.id === offer.deadline.id);
  assert.throws(() => e.applyAction(proposed, { type: 'acceptTrade', id: offer.id }));
  const sample = winning(g, l).trades[0];
  const next = e.applyAction(proposed, {
    type: 'reviseDeadlineTrade',
    id: offer.id,
    outgoing: sample.counterOutgoing || sample.outgoing,
    cash: sample.counterCash ?? sample.cash,
  });
  assert.equal(next.trades[0].id, offer.id);
  assert.equal(next.trades[0].deadline.round, 2);
  assert.ok(next.trades[0].deadline.leading);
  assert.equal(next.day, proposed.day);
  assert.deepEqual(next.roster, proposed.roster);
  assert.equal(next.news.filter((n) => n.tradeId === offer.id).length, 2);
});
test('Ordinary trade forms cannot bypass a listed player competition or buy the target with a cash-only transfer', () => {
  const g = opened(),
    l = g.deadlineMarket.listings[0],
    player = g.roster.find((p) => p.pos === l.player.pos);
  const next = bid(g, l, player, 1000, { deadlineId: undefined });
  assert.equal(next.trades[0].deadline.id, l.id);
  const target = e.rosterFor(g, l.seller).find((p) => p.id === l.player.id);
  assert.equal(createTransferMarket(world).assess(g, target).status, 'refused');
  assert.throws(() => bid(g, l, player, 1000, { deadlineId: 'forged' }));
  assert.throws(() => bid(g, l, player, -g.budget * 10000));
});
test('Last-day regular trade offers receive a response today instead of waiting beyond the cutoff', () => {
  const g = game();
  g.day = Math.floor(g.rounds * 0.8) - 1;
  const their = e.rosterFor(g, 'kbo-lg').find((p) => p.pos === 'P'),
    own = g.roster.find((p) => p.pos === 'P');
  const proposed = e.applyAction(g, {
    type: 'proposeTrade',
    club: 'kbo-lg',
    incoming: [their.id],
    outgoing: [own.id],
    cash: 1000,
  });
  assert.equal(proposed.trades[0].due, gameDate(g));
  assert.notEqual(proposed.trades[0].status, 'pending');
  assert.equal(proposed.trades[0].expires, gameDate(g));
});
test('Injured or moved rival players cancel a sale, and leaving the club releases pending negotiations safely', () => {
  const g = opened();
  g.deadlineMarket.listings = g.deadlineMarket.listings.slice(0, 1);
  const l = g.deadlineMarket.listings[0];
  g.ownership[l.rival.player.id] = 'fa';
  g.simulation.revision++;
  const roster = structuredClone(g.roster);
  createTrades(world).tick(g);
  assert.equal(l.status, 'cancelled');
  assert.deepEqual(g.roster, roster);
  assert.ok(e.rosterFor(g, l.seller).some((p) => p.id === l.player.id));
  const h = winning(opened()),
    old = structuredClone(h.roster);
  h.managerCareer.status = 'unemployed';
  createTrades(world).tick(h);
  assert.equal(h.trades[0].status, 'expired');
  assert.deepEqual(h.roster, old);
  assert.ok(h.deadlineMarket.listings.every((l) => l.status === 'cancelled'));
});
test('Rival comparison uses the same cash cap as the normal seller and no new lottery affects retries', () => {
  const g = opened(),
    l = g.deadlineMarket.listings[0],
    sellers = e.rosterFor(g, l.seller),
    target = sellers.find((p) => p.id === l.player.id),
    p = g.roster.find((p) => p.pos === l.player.pos);
  const first = tradePackageValue(sellers, [p], [target], 1e6),
    second = tradePackageValue(sellers, [p], [target], 1e8);
  assert.equal(first.total, second.total);
  const a = bid(g, l, p, 1000),
    b = bid(g, l, p, 1000);
  assert.deepEqual(a, b);
  assert.equal(a.seed, g.seed);
});
