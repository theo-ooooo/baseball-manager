import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-trade-workflow-tests.cjs');
buildSync({
  stdin: {
    contents: `export * from './tests/fixtures/long-term';
      export * from './packages/shared/src/trade-status';
      export * from './apps/web/src/features/inbox/inbox-model';
      export * from './apps/web/src/features/inbox/report-destination';`,
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
  createTrades,
  tradeStatus,
  tradeNeedsConfirmation,
  isActiveTrade,
  newsNeedsAction,
  reportDestination,
  presentTradeNews,
} = createRequire(import.meta.url)(out);
function proposed() {
  let g = e.newGame('kbo-lg', '협상 흐름 검증', 'short', 434);
  const outgoing = g.roster.find((p) => p.pos === 'P' && p.squad === 'reserve');
  const incoming = e.rosterFor(g, 'kbo-lotte').find((p) => p.pos === 'P');
  return e.applyAction(g, {
    type: 'proposeTrade',
    club: 'kbo-lotte',
    cash: 1000,
    outgoing: [outgoing.id],
    incoming: [incoming.id],
  });
}

test('Trade mail follows the actual offer from pending through confirmation to completion', () => {
  let g = proposed();
  const id = g.trades[0].id;
  const firstMail = g.news.find((n) => n.tradeId === id);
  assert.ok(firstMail);
  const legacy = { ...firstMail, tradeId: undefined };
  assert.equal(presentTradeNews(legacy, g, (id) => e.getClub(id).name).tradeId, id);
  assert.equal(legacy.tradeId, undefined);
  assert.equal(newsNeedsAction(firstMail, g), false);
  assert.match(reportDestination(firstMail, g).label, /진행 상황/);
  g.day += 2;
  createTrades(world).tick(g);
  assert.equal(tradeNeedsConfirmation(g, g.trades[0]), true);
  assert.equal(g.news.filter((n) => n.tradeId === id && newsNeedsAction(n, g)).length, 1);
  assert.equal(newsNeedsAction(firstMail, g), false);
  const answer = g.news.find((n) => n.tradeId === id);
  assert.match(reportDestination(answer, g).label, /최종 확정/);
  g = e.applyAction(g, { type: 'acceptTrade', id });
  assert.equal(tradeStatus(g, g.trades[0]), 'completed');
  assert.equal(isActiveTrade(g, g.trades[0]), false);
  for (const mail of g.news.filter((n) => n.tradeId === id)) {
    assert.equal(newsNeedsAction(mail, g), false);
    assert.match(reportDestination(mail, g).detail, /추가 확정은 필요하지 않습니다/);
  }
  assert.throws(() => e.applyAction(g, { type: 'acceptTrade', id }));
});

test('Expired and withdrawn trades leave the work queue and produce only one terminal notice', () => {
  let g = proposed();
  const trades = createTrades(world);
  g.day += 2;
  trades.tick(g);
  g.day += 8;
  assert.equal(
    tradeNeedsConfirmation(g, g.trades[0]),
    true,
    'confirmation remains valid on the final day',
  );
  g.day++;
  assert.equal(
    tradeStatus(g, g.trades[0]),
    'expired',
    'a stale stored accepted status cannot remain actionable',
  );
  assert.equal(
    newsNeedsAction(
      g.news.find((n) => n.tradeId),
      g,
    ),
    false,
  );
  trades.tick(g);
  const expired = g.news.filter((n) => n.tradeId && n.body.includes('기한이 지났습니다'));
  assert.equal(expired.length, 1);
  trades.tick(g);
  assert.equal(g.news.filter((n) => n.id === expired[0].id).length, 1);
  g = proposed();
  const id = g.trades[0].id;
  g = e.applyAction(g, { type: 'withdrawTrade', id });
  assert.equal(tradeStatus(g, g.trades[0]), 'withdrawn');
  assert.ok(g.news.some((n) => n.tradeId === id && n.body.includes('철회')));
  assert.equal(
    tradeNeedsConfirmation(
      { ...g, managerCareer: { ...g.managerCareer, status: 'unemployed' } },
      { ...g.trades[0], status: 'accepted' },
    ),
    false,
  );
});

test('Two trades with the same club on the same day retain separate notices and tasks', () => {
  let g = proposed();
  const first = g.trades[0];
  const outgoing = g.roster.find((p) => p.pos === 'P' && !first.outgoing.includes(p.id));
  const incoming = e
    .rosterFor(g, 'kbo-lotte')
    .find((p) => p.pos === 'P' && !first.incoming.includes(p.id));
  g = e.applyAction(g, {
    type: 'proposeTrade',
    club: 'kbo-lotte',
    cash: 1000,
    outgoing: [outgoing.id],
    incoming: [incoming.id],
  });
  assert.equal(g.news.filter((n) => n.tradeId).length, 2);
  g.day += 2;
  createTrades(world).tick(g);
  assert.equal(g.news.filter((n) => n.tradeId).length, 4);
  const ambiguous = { ...g.news.find((n) => n.tradeId), tradeId: undefined };
  assert.equal(
    presentTradeNews(ambiguous, g, (id) => e.getClub(id).name),
    ambiguous,
  );
  assert.equal(g.news.filter((n) => newsNeedsAction(n, g) && n.tradeId).length, 2);
  const completedId = g.trades[0].id;
  g = e.applyAction(g, { type: 'acceptTrade', id: completedId });
  assert.equal(g.news.filter((n) => newsNeedsAction(n, g) && n.tradeId).length, 1);
  assert.ok(g.news.filter((n) => n.tradeId === completedId).every((n) => !newsNeedsAction(n, g)));
});
