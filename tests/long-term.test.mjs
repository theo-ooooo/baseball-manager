import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finishInterview, signManager, reachFixture } from './helpers/manager.mjs';
const out = join(tmpdir(), 'dugout-longterm-tests.cjs');
buildSync({
  entryPoints: ['tests/fixtures/long-term.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  world,
  createWorldSimulation,
  archivePlayer,
  medicalTick,
  coachReports,
  createTrades,
  gameDate,
  addDays,
  managerOfferActionLabel,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lg', '검증 감독', 'short', 434);
test('An unemployed start preserves league managers and must complete six questions, agreement and signature without a written proposal', () => {
  let g = e.newGame('kbo-lg', '', 'short', 434, { unemployed: true });
  assert.equal(g.manager, '신임 감독');
  assert.equal(g.managerJobs['kbo-lg'].managerName, '염경엽');
  assert.equal(g.managerCareer.contract, undefined);
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  const id = g.managerCareer.offers.find((o) => o.status === 'invited').id;
  assert.equal(managerOfferActionLabel(g.managerCareer.offers[0], g), '면접 초청 확인');
  assert.throws(() =>
    e.applyAction(g, { type: 'submitManagerProposal', id, proposal: 'too early' }),
  );
  g = e.applyAction(g, { type: 'acceptManagerInvite', id });
  assert.throws(() =>
    e.applyAction(g, { type: 'managerInterview', id, question: 'budget', answer: 'within' }),
  );
  g = finishInterview(e, g, id);
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).interview.length, 6);
  assert.equal(
    managerOfferActionLabel(
      g.managerCareer.offers.find((o) => o.id === id),
      g,
    ),
    '계약 협상',
  );
  assert.throws(() => e.applyAction(g, { type: 'signManager', id }));
  const before = structuredClone(g);
  g = e.applyAction(g, { type: 'acceptManagerTerms', id, termsVersion: 1 });
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.equal(g.budget, before.budget);
  assert.equal(
    managerOfferActionLabel(
      g.managerCareer.offers.find((o) => o.id === id),
      g,
    ),
    '최종 계약서 서명',
  );
  assert.throws(() =>
    e.applyAction(g, { type: 'signManager', id, termsVersion: 1, signature: g.manager }),
  );
  assert.throws(() =>
    e.applyAction(g, { type: 'signManager', id, termsVersion: 2, signature: '다른 사람' }),
  );
  const signed = e.applyAction(g, {
    type: 'signManager',
    id,
    termsVersion: 2,
    signature: g.manager,
  });
  assert.equal(signed.managerCareer.status, 'employed');
  const closedMail = signed.news.filter((n) => n.managerOfferId === id);
  assert.ok(closedMail.length);
  assert.ok(closedMail.every((n) => n.contractResolution === 'signed'));
  assert.equal(gameDate(signed), gameDate(g));
  assert.deepEqual(signed.standings, g.standings);
  assert.equal(signed.managerCareer.history.length, 0);
});
test('Contract counteroffers are delayed and versioned; expiry cannot resurrect a pending negotiation', () => {
  let g = e.newGame('kbo-lg', '계약 검증', 'short', 432, { unemployed: true });
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  const id = g.managerCareer.offers[0].id;
  g = finishInterview(e, g, id);
  let o = g.managerCareer.offers.find((o) => o.id === id);
  const proposed = o.salary * 2;
  g = e.applyAction(g, {
    type: 'negotiateManagerContract',
    id,
    termsVersion: 1,
    salary: proposed,
    years: 3,
    targetRank: o.targetRank,
  });
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.throws(
    () => e.applyAction(g, { type: 'acceptManagerTerms', id, termsVersion: 2 }),
    /검토/,
  );
  g = e.applyAction(g, { type: 'managerContinue' });
  o = g.managerCareer.offers.find((o) => o.id === id);
  assert.equal(o.contractTerms.status, 'counter');
  assert.ok(o.contractTerms.salary < proposed);
  assert.equal(o.contractTerms.years, 2);
  assert.throws(
    () => e.applyAction(g, { type: 'acceptManagerTerms', id, termsVersion: 2 }),
    /변경/,
  );
  const original = structuredClone(g);
  g = signManager(e, g, id);
  assert.equal(g.managerCareer.contract.throughYear, g.year + 1);
  o = original.managerCareer.offers.find((o) => o.id === id);
  o.expires = addDays(gameDate(original), -1);
  o.contractTerms.status = 'pending';
  o.contractTerms.due = gameDate(original);
  o.contractTerms.proposed = { salary: 1, years: 1, targetRank: 1 };
  const expired = e
    .applyAction(original, { type: 'managerContinue' })
    .managerCareer.offers.find((o) => o.id === id);
  assert.equal(expired.status, 'expired');
});
test('Employed managers can apply privately or publicly while preserving their current contract', () => {
  const g = game();
  const club = Object.values(g.managerJobs).find(
    (j) => j.club !== g.club && e.getClub(j.club).league === 'kbo' && j.confidence < 35,
  ).club;
  const privateApp = e.applyAction(g, { type: 'applyManager', club, targetRank: 4, public: false });
  assert.equal(privateApp.managerCareer.status, 'employed');
  assert.deepEqual(privateApp.managerCareer.contract, g.managerCareer.contract);
  assert.equal(privateApp.managerJobs[g.club].confidence, g.managerJobs[g.club].confidence);
  const publicApp = e.applyAction(g, { type: 'applyManager', club, targetRank: 4, public: true });
  assert.ok(publicApp.managerJobs[g.club].confidence < g.managerJobs[g.club].confidence);
});
test('Ordinary fatigue recommends first-team rest and sustained poor performance alone permits demotion', () => {
  const g = game(),
    p = g.roster.find((p) => p.id === g.starter);
  p.condition = 35;
  p.stats = { ...p.stats, g: 1, outs: 21, er: 0 };
  coachReports(g);
  assert.ok(!g.coachRecommendations.some((r) => r.playerId === p.id && r.target === 'reserve'));
  assert.ok(g.news.some((n) => n.kind === 'recovery' && n.playerId === p.id));
  g.coachRecommendations = [];
  p.stats = { ...p.stats, g: 4, outs: 60, er: 18 };
  coachReports(g);
  assert.ok(g.coachRecommendations.some((r) => r.playerId === p.id && r.target === 'reserve'));
});
test('Rehabilitation and early return enforce dates and do not stack recurrence discounts', () => {
  let g = game(),
    p = g.roster.find((p) => p.pos !== 'P' && p.squad === 'reserve'),
    id = p.id,
    today = gameDate(g);
  p.injury = {
    id: 'injury-test',
    name: '근육 부상',
    occurred: today,
    returnDate: addDays(today, 14),
    earliestReturn: addDays(today, 8),
    severity: 'moderate',
    phase: 'treatment',
    recurrenceRisk: 35,
  };
  g = e.applyAction(g, { type: 'rehabPlayer', id });
  assert.equal(g.roster.find((p) => p.id === id).injury.recurrenceRisk, 25);
  assert.throws(() => e.applyAction(g, { type: 'earlyReturnPlayer', id, confirm: true }), /아직/);
  g.day += 8;
  g = e.applyAction(g, { type: 'earlyReturnPlayer', id, confirm: true });
  g = e.applyAction(g, { type: 'rehabPlayer', id });
  assert.equal(g.roster.find((p) => p.id === id).injury.recurrenceRisk, 25);
  g.day += 6;
  medicalTick(g);
  assert.equal(g.roster.find((p) => p.id === id).injury, undefined);
});
test('Trades exchange whole rosters and cash once, archive stints and reject invalid or stale packages', () => {
  let g = game();
  const club = 'kbo-lotte',
    outgoing = g.roster.find((p) => p.pos === 'P' && p.squad === 'reserve'),
    incoming = e.rosterFor(g, club).find((p) => p.pos === 'P');
  const oldBudget = g.budget,
    ids = { outgoing: [outgoing.id], incoming: [incoming.id] };
  outgoing.stats.outs = 9;
  incoming.stats.outs = 12;
  assert.throws(() =>
    e.applyAction(g, {
      type: 'proposeTrade',
      club,
      cash: 0,
      outgoing: [outgoing.id, outgoing.id],
      incoming: ids.incoming,
    }),
  );
  g = e.applyAction(g, { type: 'proposeTrade', club, cash: 1000, ...ids });
  const id = g.trades[0].id;
  assert.throws(() => e.applyAction(g, { type: 'acceptTrade', id }), /답변/);
  g.day += 2;
  createTrades(world).tick(g);
  assert.equal(g.trades[0].status, 'accepted');
  g = e.applyAction(g, { type: 'acceptTrade', id });
  assert.equal(g.budget, oldBudget - 1000);
  assert.equal(g.ownership[outgoing.id], club);
  assert.equal(g.ownership[incoming.id], g.club);
  assert.ok(g.roster.some((p) => p.id === incoming.id));
  assert.ok(!g.roster.some((p) => p.id === outgoing.id));
  assert.equal(g.pendingRecords.filter((r) => r.kind === 'transfer').length, 2);
  assert.throws(() => e.applyAction(g, { type: 'acceptTrade', id }));
});
test('Drafts finish all three rounds exactly once and add generated prospects with contracts', () => {
  let g = e.applyAction(game(), { type: 'startDraft' });
  const before = g.roster.length;
  g = e.applyAction(g, { type: 'draftDelegate' });
  assert.equal(g.draft.status, 'finished');
  assert.equal(g.draft.picks.length, g.draft.order.length * 3);
  assert.equal(g.roster.length, before + 3);
  assert.equal(
    new Set(g.draft.picks.filter((p) => p.playerId).map((p) => p.playerId)).size,
    g.draft.picks.filter((p) => p.playerId).length,
  );
  assert.throws(() => e.applyAction(g, { type: 'startDraft' }));
});
test('Retirement archives careers, supplies coaching candidates and replenishes AI positions', () => {
  let g = game();
  const sim = createWorldSimulation(world),
    club = 'kbo-lotte';
  const pitchers = e.rosterFor(g, club).filter((p) => p.pos === 'P');
  for (const p of pitchers) {
    p.age = 44;
    sim.commit(g, p);
  }
  const retiredId = pitchers[0].id;
  g.phase = 'finished';
  g = e.applyAction(g, { type: 'nextSeason' });
  assert.ok(
    g.pendingRecords.some((r) => r.playerId === retiredId && r.kind === 'retirement' && r.coach),
  );
  assert.ok(!e.rosterFor(g, club).some((p) => p.id === retiredId));
  assert.ok(e.rosterFor(g, club).filter((p) => p.pos === 'P').length >= 9);
  assert.ok(Buffer.byteLength(JSON.stringify({ ...g, pendingRecords: undefined })) < 1800000);
});
test('AI box scores never assign more hits than at bats and transfer archives store only stint deltas', () => {
  const g = game(),
    sim = createWorldSimulation(world),
    p = g.roster[0];
  p.stats.h = 10;
  archivePlayer(g, p, 'transfer', [], 'kbo-lotte');
  p.club = 'kbo-lotte';
  p.stats.h += 4;
  archivePlayer(g, p, 'season');
  assert.deepEqual(
    g.pendingRecords.map((r) => r.stats.h),
    [10, 4],
  );
  for (let i = 0; i < 20; i++)
    sim.recordGame(g, {
      id: `score-test-${i}`,
      home: 'kbo-lotte',
      away: 'kbo-samsung',
      homeScore: 24,
      awayScore: 22,
    });
  for (const p of [...e.rosterFor(g, 'kbo-lotte'), ...e.rosterFor(g, 'kbo-samsung')])
    assert.ok(p.stats.h <= p.stats.ab, `${p.id}: h ${p.stats.h} / ab ${p.stats.ab}`);
});
test('Bullpen warm-up shares the match change cap and cannot alter consumed play', () => {
  let g = reachFixture(e, game());
  g = e.applyAction(g, { type: 'startMatch' });
  const p = g.roster.find((p) => p.pos === 'P' && p.squad !== 'reserve' && p.id !== g.starter);
  const before = structuredClone(g.liveMatch.timeline);
  g = e.applyAction(g, { type: 'bullpen', id: p.id, mode: 'warm', cursor: 0, timelineVersion: 1 });
  assert.deepEqual(g.liveMatch.timeline, before);
  g.liveMatch.changes = Array.from({ length: 39 }, () => ({ cursor: 0 }));
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'bullpen',
        id: p.id,
        mode: 'standby',
        cursor: 0,
        timelineVersion: 1,
      }),
    /횟수/,
  );
});
