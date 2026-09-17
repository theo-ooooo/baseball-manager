import { finishInterview, signManager } from './helpers/manager.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-career-systems-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/career-systems.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  world,
  engine: e,
  createManagerCareer,
  coachReports,
  settleClubDay,
  prepareFinances,
  financeAssessment,
  annualPayroll,
  presentState,
  gameDate,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', '경력 감독', 'short', 436);
const progress = (g, n) => {
  for (let i = 0; i < n; i++) g = e.applyAction(g, { type: 'managerContinue' });
  return g;
};
const hire = (g, club) => {
  Object.assign(g.managerJobs[club], { vacant: true, confidence: 0 });
  g = e.applyAction(g, { type: 'applyManager', club, targetRank: 4 });
  const id = g.managerCareer.offers.find((o) => o.club === club && o.status === 'pending').id;
  g = finishInterview(e, progress(g, 3), id);
  return signManager(e, g, id);
};

test('Resignation, unemployment and re-employment continue the same world and restore previous club operations', () => {
  let g = game();
  g.roster[0].stats.h = 41;
  g.roster[0].salary = 17;
  g.tactic = 'patient';
  const player = g.roster[0].id;
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  const earnings = g.managerCareer.earnings;
  assert.equal(g.managerCareer.status, 'unemployed');
  for (const type of ['auto', 'negotiate', 'coach', 'startMatch', 'scouting'])
    assert.throws(() => e.applyAction(g, { type }), /무직/);
  const beforeDate = gameDate(g);
  g = hire(g, 'kbo-lg');
  assert.ok(gameDate(g) > beforeDate);
  assert.equal(g.managerCareer.earnings, earnings + g.managerCareer.contract.signingBonus);
  assert.equal(g.club, 'kbo-lg');
  assert.equal(g.managerCareer.history[0].club, 'kbo-lotte');
  const oldTeam = g.transferred.filter((p) => p.club === 'kbo-lotte');
  assert.equal(oldTeam.find((p) => p.id === player).salary, 17);
  assert.equal(oldTeam.find((p) => p.id === player).stats.h, 41);
  const standings = structuredClone(g.standings);
  const savedFinance = structuredClone(g.clubCareers['kbo-lotte']);
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  g = hire(g, 'kbo-lotte');
  assert.equal(g.club, 'kbo-lotte');
  assert.equal(g.roster.find((p) => p.id === player).salary, 17);
  assert.equal(g.roster.find((p) => p.id === player).stats.h, 41);
  assert.equal(g.tactic, 'patient');
  assert.ok(g.budget <= savedFinance.budget + savedFinance.finances.annualSupport);
  assert.deepEqual(g.standings, standings); // These dates precede regular-season fixtures.
  assert.equal(
    new Set([...g.roster, ...g.transferred].map((p) => p.id)).size,
    g.roster.length + g.transferred.length,
  );
  assert.equal(presentState(g).clubCareers, undefined);
});

test('Season target is binding: a failure sacks the manager and success proposes renewal only once', () => {
  const career = createManagerCareer(world);
  let g = e.applyAction(game(), { type: 'managerTarget', targetRank: 1 });
  const own = g.standings.kbo.find((s) => s.club === g.club);
  own.w = 30;
  own.l = 0;
  g.phase = 'finished';
  const salary = g.managerCareer.contract.salary;
  career.review(g);
  assert.equal(g.managerCareer.contract.salary, salary);
  assert.equal(
    g.managerCareer.offers.find((o) => o.source === 'renewal').salary,
    Math.round(salary * 1.15 * 100) / 100,
  );
  const saved = JSON.stringify(g.managerCareer);
  career.review(g);
  assert.equal(JSON.stringify(g.managerCareer), saved);
  g = e.applyAction(game(), { type: 'managerTarget', targetRank: 1 });
  g.standings.kbo.find((s) => s.club !== g.club).w = 20;
  g.phase = 'finished';
  career.review(g);
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.equal(g.managerCareer.history[0].reason, 'sacked');
  assert.equal(g.managerCareer.contract, undefined);
  // A vacancy created by dismissal must not immediately recruit the dismissed manager.
  for (const job of Object.values(g.managerJobs)) {
    if (job.club === g.club) continue;
    job.vacant = false;
    job.confidence = 100;
    job.baseConfidence = 100;
  }
  delete g.managerCareer.lastApproach;
  g.day += 3;
  career.tick(g);
  assert.ok(!g.managerCareer.offers.some((o) => o.club === g.club && o.source === 'approach'));
});

test('Vacation advances through games and reports, returns on time and validates bounds', () => {
  let g = game();
  assert.throws(() => e.applyAction(g, { type: 'endVacation' }), /휴가 중/);
  for (const days of [0, 29, 1.2, Infinity])
    assert.throws(() => e.applyAction(g, { type: 'startVacation', days }));
  const before = g.day;
  g = e.applyAction(g, { type: 'startVacation', days: 7 });
  assert.equal(g.day, before);
  assert.throws(() => e.applyAction(g, { type: 'auto' }), /휴가/);
  g = e.applyAction(g, { type: 'managerContinue', count: 7 });
  assert.equal(g.day, before + 7);
  assert.equal(g.managerCareer.vacationUntil, undefined);
  assert.throws(() => e.applyAction(g, { type: 'endVacation' }), /휴가 중/);
  assert.equal(g.history.filter((r) => r.friendly).length, 1);
  assert.ok(g.managerCareer.earnings > 0);
});

test('Job offers are delayed, reputation dependent, expire and cannot be signed twice', () => {
  let g = e.applyAction(game(), { type: 'resignManager', confirm: true });
  g.managerJobs['kbo-lg'].vacant = true;
  g = e.applyAction(g, { type: 'applyManager', club: 'kbo-lg', targetRank: 4 });
  assert.throws(
    () => e.applyAction(g, { type: 'signManager', id: g.managerCareer.offers[0].id }),
    /유효/,
  );
  assert.throws(() => e.applyAction(g, { type: 'applyManager', club: 'kbo-lg', targetRank: 4 }));
  const id = g.managerCareer.offers[0].id;
  g = progress(g, 3);
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'interview');
  g = finishInterview(e, g, id);
  const hired = signManager(e, g, id);
  assert.throws(() => e.applyAction(hired, { type: 'signManager', id }));
  g = progress(g, 15);
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'expired');
  assert.throws(() => e.applyAction(g, { type: 'signManager', id }));
  let inexperienced = e.applyAction(game(), { type: 'resignManager', confirm: true });
  inexperienced.managerCareer.reputation = 20;
  inexperienced.managerJobs['kbo-lg'].vacant = true;
  inexperienced = e.applyAction(inexperienced, {
    type: 'applyManager',
    club: 'kbo-lg',
    targetRank: 4,
  });
  inexperienced = progress(inexperienced, 3);
  assert.equal(inexperienced.managerCareer.offers[0].status, 'rejected');
});

test('Coach promotion and demotion reports support legal atomic swaps without altering contracts or stats', () => {
  let g = game();
  const reserve = g.roster.find((p) => p.squad === 'reserve' && p.pos === 'P');
  reserve.reserveStats = { ...reserve.stats, outs: 18, er: 0 };
  const poor = g.roster.find((p) => p.squad !== 'reserve' && p.pos !== 'P');
  poor.stats = { ...poor.stats, g: 10, ab: 45, h: 2 };
  coachReports(g);
  assert.ok(g.coachRecommendations.some((r) => r.target === 'first'));
  assert.ok(g.coachRecommendations.some((r) => r.target === 'reserve'));
  const size = g.coachRecommendations.length;
  coachReports(g);
  assert.equal(g.coachRecommendations.length, size);
  const rec = g.coachRecommendations.find((r) => r.playerId === reserve.id);
  const before = g.roster.map((p) => ({ id: p.id, salary: p.salary, stats: p.stats }));
  g = e.applyAction(g, { type: 'coachRecommendation', id: rec.id, accept: true });
  assert.equal(g.roster.find((p) => p.id === reserve.id).squad, 'first');
  assert.equal(g.roster.find((p) => p.id === rec.replacementId).squad, 'reserve');
  assert.deepEqual(
    g.roster.map((p) => ({ id: p.id, salary: p.salary, stats: p.stats })),
    before,
  );
  assert.throws(() => e.applyAction(g, { type: 'coachRecommendation', id: rec.id, accept: true }));
});

test('Season support stays fixed after signings, wages include the manager and settlements are bounded', () => {
  const g = game();
  const support = g.finances.annualSupport;
  g.roster[0].salary += 10000;
  prepareFinances(g, 'kbo');
  assert.equal(g.finances.annualSupport, support);
  const before = g.budget;
  settleClubDay(g, 'kbo');
  assert.ok(
    Math.abs(g.budget - (before + g.finances.receivedSupport - g.finances.paidWages)) < 1e-9,
  );
  assert.ok(g.finances.paidWages > 0 && g.finances.receivedSupport > 0);
  for (let i = 0; i < 600; i++) settleClubDay(g, 'kbo');
  assert.ok(Math.abs(g.finances.receivedSupport - support) < 1e-6);
  const balance = g.budget;
  settleClubDay(g, 'kbo');
  assert.equal(g.budget, balance);
});

test('Manager job list enforces the strict 35 percent threshold in the server and updates after results', () => {
  let g = e.applyAction(game(), { type: 'resignManager', confirm: true });
  const job = g.managerJobs['kbo-lg'];
  Object.assign(job, { vacant: false, confidence: 35, baseConfidence: 35 });
  assert.throws(
    () => e.applyAction(g, { type: 'applyManager', club: job.club, targetRank: 4 }),
    /35%/,
  );
  job.confidence = job.baseConfidence = 34;
  const applied = e.applyAction(g, { type: 'applyManager', club: job.club, targetRank: 4 });
  assert.equal(applied.managerJobs[job.club].vacant, false);
  assert.equal(applied.managerJobs[job.club].managerName, job.managerName);
  const row = g.standings.kbo.find((s) => s.club === job.club);
  row.w = 8;
  createManagerCareer(world).tick(g);
  assert.ok(g.managerJobs[job.club].confidence >= 35);
  assert.throws(
    () => e.applyAction(g, { type: 'applyManager', club: job.club, targetRank: 4 }),
    /35%/,
  );
  job.vacant = true;
  assert.doesNotThrow(() =>
    e.applyAction(g, { type: 'applyManager', club: job.club, targetRank: 4 }),
  );
});

test('Joining a different league preserves the world date, all standings and scouting familiarity', () => {
  let g = e.applyAction(game(), { type: 'resignManager', confirm: true });
  const dest = world.clubs.find((c) => c.league === 'npb').id;
  g.managerJobs[dest].vacant = true;
  g.managerCareer.reputation = 99;
  g = e.applyAction(g, { type: 'applyManager', club: dest, targetRank: 4 });
  const id = g.managerCareer.offers[0].id;
  g = finishInterview(e, progress(g, 3), id);
  const date = gameDate(g),
    year = g.year,
    standings = structuredClone(g.standings);
  g = signManager(e, g, id);
  assert.equal(gameDate(g), date);
  assert.equal(g.year, year);
  assert.deepEqual(g.standings, standings);
  assert.ok(g.knowledge.leagues.includes('npb') && g.knowledge.leagues.includes('kbo'));
  assert.ok(g.finances.settledDays > 0);
  assert.equal(g.roster.length, new Set(g.roster.map((p) => p.id)).size);
});

test('Offseason job applications get a real answer and can be signed without restarting playoffs', () => {
  let g = game();
  g.phase = 'finished';
  g.day = g.rounds + 8;
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  g = e.applyAction(g, { type: 'applyManager', club: g.club, targetRank: 4 });
  const id = g.managerCareer.offers[0].id;
  const year = g.year,
    day = g.day;
  g = progress(g, 3);
  assert.equal(g.day, day + 3);
  assert.equal(g.year, year);
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'interview');
  g = signManager(e, finishInterview(e, g, id), id);
  assert.equal(g.phase, 'finished');
  const contract = structuredClone(g.managerCareer.contract);
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  assert.equal(g.managerCareer.status, 'employed');
  assert.deepEqual(g.managerCareer.contract, contract);
  g = e.applyAction(g, { type: 'nextSeason' });
  assert.equal(g.year, year + 1);
  assert.equal(g.phase, 'preseason');
});

test('Missing league and club records in older saves are backfilled without resetting existing results', () => {
  const g = game();
  const club = g.standings.kbo[0].club;
  g.standings.kbo[0].w = 9;
  delete g.standings.npb;
  g.standings.kbo.pop();
  delete g.managerJobs[club];
  const career = createManagerCareer(world);
  career.tick(g);
  assert.equal(g.standings.kbo[0].w, 9);
  assert.equal(g.standings.kbo.length, world.clubs.filter((c) => c.league === 'kbo').length);
  assert.equal(g.standings.npb.length, world.clubs.filter((c) => c.league === 'npb').length);
  assert.ok(g.managerJobs[club]);
});

test('Joining a league that has finished allows world dates to continue without forcing a season reset', () => {
  let g = e.newGame(world.clubs.find((c) => c.league === 'mlb').id, '시즌 중 부임', 'short', 435);
  g.day = 33;
  g.phase = 'regular';
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  g.managerCareer.reputation = 99;
  g = hire(g, world.clubs.find((c) => c.league === 'cpbl').id);
  assert.equal(g.phase, 'finished');
  const date = gameDate(g),
    year = g.year,
    contract = structuredClone(g.managerCareer.contract);
  const mlbGames = g.standings.mlb.reduce((total, row) => total + row.w, 0);
  g = e.applyAction(g, { type: 'managerContinue', count: 7 });
  assert.equal(g.year, year);
  assert.ok(gameDate(g) > date);
  assert.ok(g.standings.mlb.reduce((total, row) => total + row.w, 0) > mlbGames);
  assert.deepEqual(g.managerCareer.contract, contract);
});

test('Advancing the season explicitly expires old applications instead of leaving un-signable offers active', () => {
  let g = game();
  g.phase = 'finished';
  g.day = g.rounds + 8;
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  g = e.applyAction(g, { type: 'applyManager', club: g.club, targetRank: 4 });
  const id = g.managerCareer.offers[0].id;
  g = e.applyAction(g, { type: 'nextSeason' });
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'expired');
});

test('Overspending lowers board confidence without compounding and improves when spending is corrected', () => {
  const g = game();
  const careers = createManagerCareer(world);
  const healthy = financeAssessment(g, 'kbo');
  assert.equal(healthy.penalty, 0);
  const payroll = annualPayroll(g);
  const support = g.finances.annualSupport;
  assert.ok(support >= payroll * 0.95);
  const salary = g.roster[0].salary;
  g.roster[0].salary += payroll;
  careers.tick(g);
  const job = g.managerJobs[g.club];
  const penalty = financeAssessment(g, 'kbo').penalty;
  assert.ok(penalty > 0);
  const confidence = job.confidence;
  const newsCount = g.news.length;
  careers.tick(g);
  assert.equal(job.confidence, confidence);
  assert.equal(g.news.length, newsCount);
  assert.equal(g.finances.annualSupport, support);
  g.roster[0].salary = salary;
  careers.tick(g);
  assert.ok(job.confidence > confidence);
  assert.equal(financeAssessment(g, 'kbo').penalty, 0);
  g.expenses += 3500;
  careers.tick(g);
  assert.ok(financeAssessment(g, 'kbo').penalty > 0);
  assert.match(job.reason, /추가 지출 과다/);
});
test('Legacy finance balancing preserves paid amounts and upgrades future support once', () => {
  const g = game();
  delete g.finances.balanceVersion;
  delete g.finances.wageBudget;
  settleClubDay(g, 'kbo');
  const before = {
    budget: g.budget,
    paid: g.finances.paidWages,
    received: g.finances.receivedSupport,
    support: g.finances.annualSupport,
  };
  prepareFinances(g, 'kbo');
  prepareFinances(g, 'kbo');
  assert.equal(g.budget, before.budget);
  assert.equal(g.finances.paidWages, before.paid);
  assert.equal(g.finances.receivedSupport, before.received);
  assert.equal(g.finances.annualSupport, before.support);
});
