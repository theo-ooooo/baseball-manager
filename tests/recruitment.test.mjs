import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForReply } from './helpers/recruitment.mjs';
const out = join(tmpdir(), 'dugout-recruitment-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine: e } = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', 'Recruitment', 'full', 76);
const coach = (g) => e.coachPool(g.year).find((c) => c.role === '투수' && c.skill > 85);

test('Player terms arrive on a later date; counter acceptance and signing are separate', () => {
  let g = game();
  g.reputation = 99;
  const p = e.marketPlayers(g).find((p) => p.club === 'fa');
  const initial = structuredClone(g);
  g = e.applyAction(g, { type: 'negotiate', id: p.id, salary: p.salary * 0.85, years: 1 });
  const id = g.deals[0].id;
  assert.equal(g.deals[0].status, 'pending');
  assert.equal(g.budget, initial.budget);
  assert.deepEqual(g.roster, initial.roster);
  assert.throws(() => e.signDeal(g, id), /기다려/);
  assert.throws(
    () => e.applyAction(g, { type: 'negotiate', id: p.id, salary: 500, years: 3 }),
    /검토/,
  );
  g = waitForReply(e, g, id);
  assert.equal(g.deals[0].status, 'counter');
  assert.ok(g.news.some((n) => n.actionView === 'agents' && n.title.includes(p.name)));
  assert.throws(() => e.signDeal(g, id), /합의/);
  g = e.applyAction(g, { type: 'acceptDealCounter', id });
  const balance = g.budget,
    d = g.deals[0];
  g = e.applyAction(g, { type: 'sign', id });
  assert.equal(g.budget, balance - d.fee - d.agentFee - d.salary * 0.15);
  assert.equal(g.roster.filter((v) => v.id === p.id).length, 1);
  assert.throws(() => e.signDeal(g, id));
});

test('A club fee agreement must precede personal terms, and calendar stops at each reply', () => {
  let g = game();
  g.budget = 1e8;
  const p = e
    .marketPlayers(g)
    .filter((p) => p.club === 'kbo-lg')
    .sort((a, b) => e.overall(a) - e.overall(b))[0];
  g = e.applyAction(g, { type: 'negotiate', id: p.id, salary: p.salary * 3, years: 3, fee: 0 });
  const id = g.deals[0].id;
  while (g.deals[0].status === 'pending') g = e.applyAction(g, { type: 'continueDay' });
  assert.equal(g.progress.stop, 'report');
  assert.equal(g.deals[0].stage, 'club');
  assert.equal(g.deals[0].status, 'counter');
  assert.throws(() => e.signDeal(g, id));
  g = e.applyAction(g, { type: 'acceptDealCounter', id });
  assert.equal(g.deals[0].stage, 'player');
  assert.equal(g.deals[0].status, 'pending');
  g = e.applyAction(g, { type: 'continueDay' });
  assert.equal(g.progress.stop, 'report');
  assert.equal(g.deals[0].status, 'accepted');
  g = e.signDeal(g, id);
  assert.ok(g.roster.some((v) => v.id === p.id));
});

test('Coach negotiation preserves the incumbent until agreed terms are signed', () => {
  let g = game();
  g.reputation = 99;
  const c = coach(g),
    staff = structuredClone(g.staff),
    balance = g.budget;
  g = e.applyAction(g, { type: 'coachOffer', id: c.id, salary: c.salary * 0.85, years: 1 });
  const id = g.coachDeals[0].id;
  assert.deepEqual(g.staff, staff);
  assert.equal(g.budget, balance);
  assert.throws(() => e.applyAction(g, { type: 'signCoach', id }), /기다려/);
  g = waitForReply(e, g, id, true);
  assert.equal(g.coachDeals[0].status, 'counter');
  assert.deepEqual(g.staff, staff);
  assert.throws(() => e.applyAction(g, { type: 'signCoach', id }), /역제안/);
  g = e.applyAction(g, { type: 'acceptCoachCounter', id });
  const before = g.budget,
    offer = g.coachDeals[0];
  g = e.applyAction(g, { type: 'signCoach', id });
  assert.equal(g.budget, before - offer.salary * 0.5);
  assert.equal(g.staff.find((v) => v.role === '투수').contractUntil, g.year + 2);
  assert.deepEqual(
    g.staff.filter((v) => v.role !== '투수'),
    staff.filter((v) => v.role !== '투수'),
  );
});

test('Expired and withdrawn offers cannot sign or produce late replies', () => {
  let g = game();
  const c = coach(g),
    p = e.marketPlayers(g).find((p) => p.club === 'fa');
  g = e.applyAction(g, { type: 'coachOffer', id: c.id, salary: c.salary * 2, years: 3 });
  const coachId = g.coachDeals[0].id;
  g = e.applyAction(g, { type: 'withdrawCoach', id: coachId });
  g = e.negotiate(g, p.id, p.salary * 2, 3);
  const id = g.deals[0].id;
  g = e.applyAction(g, { type: 'withdrawDeal', id });
  g = e.advance(g, 3);
  assert.equal(g.coachDeals[0].status, 'withdrawn');
  assert.equal(g.deals[0].status, 'withdrawn');
  // Opening contract reviews are valid; withdrawn negotiations must not receive replies.
  assert.ok(!g.news.some((n) => n.dealId === id || n.dealId === coachId));
  g = e.negotiate(g, p.id, p.salary * 2, 3);
  g = waitForReply(e, g, g.deals[0].id);
  g.day = g.deals[0].expires + 1;
  assert.throws(() => e.signDeal(g, g.deals[0].id), /유효기간/);
});

test('Coach replacement protects a newly changed role and rejects direct instant hiring', () => {
  let g = game();
  const c = coach(g);
  assert.throws(() => e.applyAction(g, { type: 'coach', id: c.id }), /연봉/);
  assert.throws(
    () => e.applyAction(g, { type: 'coachOffer', id: c.id, salary: NaN, years: 2 }),
    /연봉/,
  );
  g = e.applyAction(g, { type: 'coachOffer', id: c.id, salary: c.salary * 2, years: 3 });
  g = waitForReply(e, g, g.coachDeals[0].id, true);
  g.staff.find((v) => v.role === '투수').id = 'another-signed-coach';
  const before = structuredClone(g);
  assert.throws(() => e.applyAction(g, { type: 'signCoach', id: g.coachDeals[0].id }), /담당 코치/);
  assert.deepEqual(g, before);
});
