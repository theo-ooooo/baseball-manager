import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/manager-contracts';export * from './apps/api/src/domain/manager-valuation';export * from './apps/api/src/domain/manager-career';export * from './apps/api/src/domain/manager-contact';export * from './packages/shared/src/calendar';export * from './packages/shared/src/manager-career';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  engine: e,
  world,
  prepareManagerTerms,
  managerContractAction,
  tickManagerTerms,
  approachValuation,
  clubNegotiationBudget,
  updateBoardTrust,
  createManagerCareer,
  gameDate,
  lastManagerProposal,
  managerContactAvailable,
  managerContactTermsFit,
  recentManagerDeparture,
  closeDepartedClubApproaches,
  addDays,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
function fixture() {
  const g = e.newGame('kbo-lg', '협상 검증', 'short', 921, { unemployed: true });
  g.managerJobs[g.club].vacant = true;
  const o = {
    id: 'negotiation-test',
    club: g.club,
    salary: 100,
    signingBonus: 8,
    targetRank: 3,
    status: 'offered',
    applied: gameDate(g),
    due: gameDate(g),
    expires: '2026-12-31',
    message: '',
    negotiationBudget: { salary: 145, signingBonus: 35, years: 3, total: 470 },
  };
  g.managerCareer.offers = [o];
  prepareManagerTerms(o);
  return { g, o };
}
function propose(g, o, terms = {}) {
  managerContractAction(g, {
    type: 'negotiateManagerContract',
    id: o.id,
    termsVersion: o.contractTerms.version,
    salary: 200,
    signingBonus: 60,
    years: 3,
    targetRank: 3,
    ...terms,
  });
  o.contractTerms.due = gameDate(g);
  tickManagerTerms(g, o);
}
test('Dismissal prevents same-year automatic recontact and closes legacy invitations while preserving manual applications', () => {
  const { g, o } = fixture();
  const today = gameDate(g);
  g.managerCareer.history = [
    {
      club: o.club,
      from: addDays(today, -90),
      to: today,
      reason: 'sacked',
      endKind: 'dismissal',
      rank: 10,
    },
  ];
  o.source = 'approach';
  o.status = 'invited';
  const manual = { ...structuredClone(o), id: 'manual', source: 'application' };
  g.managerCareer.offers.push(manual);
  assert.equal(recentManagerDeparture(g.managerCareer, o.club, addDays(today, 30)), true);
  assert.equal(recentManagerDeparture(g.managerCareer, 'another-club', today), false);
  closeDepartedClubApproaches(g);
  assert.equal(o.status, 'expired');
  assert.equal(manual.status, 'invited');
  assert.equal(recentManagerDeparture(g.managerCareer, o.club, '2027-03-27'), false);
});
test('Manager deferral routes through the engine, extends only expiry, and stops after 28 days', () => {
  let { g, o } = fixture();
  const expiry = o.expires;
  for (let i = 0; i < 4; i++) {
    const current = g.managerCareer.offers[0];
    g = e.applyAction(g, {
      type: 'deferManagerContract',
      id: o.id,
      termsVersion: current.contractTerms.version,
    });
  }
  assert.equal(g.managerCareer.offers[0].expires, addDays(expiry, 28));
  assert.equal(g.managerCareer.offers[0].contractTerms.salary, 100);
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'deferManagerContract',
        id: o.id,
        termsVersion: g.managerCareer.offers[0].contractTerms.version,
      }),
    /28/,
  );
});
test('A long failed negotiation starts its contact cooldown on closure and remembers unmet terms after offer trimming', () => {
  const { g, o } = fixture();
  for (let i = 0; i < 3; i++) propose(g, o);
  o.applied = addDays(gameDate(g), -40);
  const closed = e.applyAction(g, { type: 'declineManager', id: o.id });
  const today = gameDate(closed);
  assert.equal(closed.managerCareer.offers[0].closedAt, today);
  assert.deepEqual(closed.managerCareer.approachHistory[o.club], {
    closedAt: today,
    minSalary: 200,
    minSigningBonus: 60,
  });
  const career = createManagerCareer(world);
  closed.managerCareer.lastApproach = addDays(today, -8);
  closed.managerJobs[o.club].vacantSince = today;
  career.tick(closed);
  assert.equal(closed.managerCareer.offers.filter((x) => x.club === o.club).length, 1);
  closed.managerCareer.offers = [];
  const saved = JSON.parse(JSON.stringify(closed)).managerCareer;
  assert.equal(managerContactAvailable(saved, o.club, addDays(today, 27)), false);
  assert.equal(managerContactAvailable(saved, o.club, addDays(today, 28)), true);
  assert.equal(managerContactTermsFit(saved, o.club, { salary: 199, signingBonus: 60 }), false);
  assert.equal(managerContactTermsFit(saved, o.club, { salary: 200, signingBonus: 59 }), false);
  assert.equal(managerContactTermsFit(saved, o.club, { salary: 200, signingBonus: 60 }), true);
  assert.equal(managerContactAvailable(saved, 'kbo-lotte', today), true);
  assert.throws(
    () => e.applyAction(closed, { type: 'applyManager', club: o.club, targetRank: 3 }),
    /14일/,
  );
});
test('Active negotiations remain exclusive after 28 days; old closed saves acquire one stable closure date', () => {
  const { g, o } = fixture();
  o.applied = addDays(gameDate(g), -40);
  assert.equal(managerContactAvailable(g.managerCareer, o.club, gameDate(g)), false);
  o.status = 'rejected';
  const career = createManagerCareer(world);
  career.tick(g);
  const date = o.closedAt;
  g.day++;
  career.tick(g);
  assert.equal(o.closedAt, date);
  assert.equal(g.managerCareer.approachHistory[o.club].closedAt, date);
});
test('Reasonable requests can be accepted; an agreement cannot be reopened', () => {
  const { g, o } = fixture();
  propose(g, o, { salary: 110, signingBonus: 10, years: 2 });
  assert.equal(o.contractTerms.status, 'agreed');
  assert.equal(o.contractTerms.salary, 110);
  assert.equal(o.contractTerms.signingBonus, 10);
  assert.throws(() => propose(g, o), /합의/);
});
test('Competing clubs improve willingness while each club keeps the original hard ceiling', () => {
  const alone = fixture(),
    competing = fixture();
  competing.g.managerCareer.offers.push(
    ...['kbo-lotte', 'kbo-ssg'].map((club) => ({
      ...structuredClone(competing.o),
      id: club,
      club,
      status: 'interview',
    })),
  );
  propose(alone.g, alone.o, { salary: 125, signingBonus: 10, years: 2 });
  propose(competing.g, competing.o, { salary: 125, signingBonus: 10, years: 2 });
  assert.equal(alone.o.contractTerms.status, 'counter');
  assert.equal(competing.o.contractTerms.status, 'agreed');
  assert.deepEqual(competing.o.negotiationBudget, alone.o.negotiationBudget);
});
test('Three unresolved rounds end at a fixed final offer with no downward counteroffer or fourth round', () => {
  const { g, o } = fixture(),
    cap = structuredClone(o.negotiationBudget);
  let salary = o.salary,
    bonus = o.signingBonus;
  for (let i = 1; i <= 3; i++) {
    g.budget *= 2; // More cash during the conversation does not enlarge its approved envelope.
    propose(g, o);
    assert.ok(o.contractTerms.salary >= salary);
    assert.ok(o.contractTerms.signingBonus >= bonus);
    assert.ok(o.contractTerms.salary <= cap.salary);
    assert.ok(o.contractTerms.signingBonus <= cap.signingBonus);
    assert.ok(
      o.contractTerms.salary * o.contractTerms.years + o.contractTerms.signingBonus <= cap.total,
    );
    assert.deepEqual(o.negotiationBudget, cap);
    assert.equal(o.contractTerms.status, i === 3 ? 'final' : 'counter');
    salary = o.contractTerms.salary;
    bonus = o.contractTerms.signingBonus;
  }
  assert.equal(salary, cap.salary);
  assert.equal(bonus, cap.signingBonus);
  assert.throws(() => propose(g, o), /최종/);
  managerContractAction(g, {
    type: 'acceptManagerTerms',
    id: o.id,
    termsVersion: o.contractTerms.version,
  });
  assert.equal(o.contractTerms.status, 'agreed');
});
test('Signing bonus is paid once, separately from recurring salary; failed or duplicate signatures do not pay', () => {
  const { g, o } = fixture();
  propose(g, o, { salary: 110, signingBonus: 10, years: 2 });
  const action = {
    type: 'signManager',
    id: o.id,
    termsVersion: o.contractTerms.version,
    signature: g.manager,
  };
  const before = structuredClone(g);
  assert.throws(() => e.applyAction(g, { ...action, termsVersion: 0 }), /계약/);
  assert.deepEqual(g, before);
  const signed = e.applyAction(g, action);
  assert.equal(signed.budget, g.budget - 10);
  assert.equal(signed.expenses, g.expenses + 10);
  assert.equal(signed.managerCareer.earnings, g.managerCareer.earnings + 10);
  assert.equal(signed.managerCareer.contract.salary, 110);
  assert.equal(signed.managerCareer.contract.signingBonus, 10);
  assert.throws(() => e.applyAction(signed, action), /계약|제안|유효/);
  const poor = structuredClone(g);
  poor.budget = 0;
  assert.throws(() => e.applyAction(poor, action), /잔액/);
  assert.equal(poor.managerCareer.earnings, g.managerCareer.earnings);
});
test('Legacy offers start with zero bonus and retain already promised terms in a fixed envelope', () => {
  const { o } = fixture();
  delete o.signingBonus;
  delete o.contractTerms;
  delete o.negotiationBudget;
  prepareManagerTerms(o);
  assert.equal(o.contractTerms.signingBonus, 0);
  const cap = structuredClone(o.negotiationBudget);
  prepareManagerTerms(o);
  assert.deepEqual(o.negotiationBudget, cap);
});
test('Club expectations differ with sporting strength and retain signed season promises', () => {
  const g = e.newGame('kbo-lotte', '위상 검증', 'short', 122);
  const targets = Object.values(g.managerJobs)
    .filter((job) => job.club.startsWith('kbo-'))
    .map((job) => job.expectation.targetRank);
  assert.ok(new Set(targets).size >= 4);
  const career = createManagerCareer(world);
  g.managerCareer.contract.targetRank = 5;
  career.prepare(g);
  assert.equal(g.managerCareer.contract.targetRank, 5);
  const job = g.managerJobs[g.club];
  job.board = {
    year: g.year,
    rank: 2,
    appointed: job.appointed,
    games: 100,
    leaderGames: 0,
    topGames: 1,
    credit: 5,
    previousConfidence: 65,
    change: 0,
  };
  g.year++;
  career.prepare(g);
  assert.equal(job.expectation.previousRank, 2);
  assert.equal(job.board, undefined);
});
test('Successful employed managers get a premium within club budget; performance cannot break the ceiling', () => {
  const g = e.newGame('kbo-lotte', '영입 검증', 'short', 123);
  g.managerCareer.contract.salary = 100;
  g.managerCareer.reputation = 80;
  const row = g.standings.kbo.find((r) => r.club === g.club);
  row.w = 25;
  row.l = 5;
  const cap = { salary: 145, signingBonus: 35, years: 3, total: 470 };
  const valued = approachValuation(g, 100, cap);
  assert.ok(valued.salary > 120);
  assert.ok(valued.salary <= 145);
  assert.ok(valued.signingBonus > 0);
  assert.ok(valued.valuation.performance >= 0.7);
  assert.equal(approachValuation(g, 100, { ...cap, salary: 110 }).salary, 110);
  const poor = clubNegotiationBudget({ ...g, budget: 0 }, g.club, 100, 1000);
  const rich = clubNegotiationBudget({ ...g, budget: 1000 }, g.club, 100, 1000);
  assert.ok(poor.salary < rich.salary);
  assert.equal(poor.signingBonus, 0);
});
test('Sustained leadership builds trust without repeated ticks farming confidence; finance penalties remain reversible', () => {
  const job = {
    club: 'a',
    appointed: '2026-03-01',
    confidence: 50,
    baseConfidence: 50,
    startWins: 0,
    startLosses: 0,
    vacant: false,
    reason: '',
    managerName: '감독',
  };
  const opts = {
    year: 2026,
    rank: 1,
    target: 5,
    count: 10,
    wins: 10,
    losses: 10,
    draws: 0,
    financePenalty: 0,
  };
  updateBoardTrust(job, opts);
  const first = job.confidence;
  for (let i = 1; i <= 5; i++) updateBoardTrust(job, { ...opts, wins: 10 + i, losses: 10 + i });
  assert.ok(job.confidence > first);
  assert.equal(job.board.leaderGames, 6);
  const same = { ...opts, wins: 15, losses: 15 },
    stable = job.confidence;
  updateBoardTrust(job, same);
  assert.equal(job.confidence, stable);
  assert.equal(job.board.leaderGames, 6);
  updateBoardTrust(job, { ...same, financePenalty: 10 });
  assert.equal(job.confidence, stable - 10);
  updateBoardTrust(job, same);
  assert.equal(job.confidence, stable);
  const fourth = { ...job, board: undefined, confidence: 50 };
  updateBoardTrust(fourth, { ...same, rank: 4 });
  assert.ok(fourth.confidence < job.confidence);
  job.appointed = '2026-04-01';
  updateBoardTrust(job, { ...opts, wins: 0, losses: 0 });
  assert.equal(job.board.leaderGames, 0);
  assert.equal(job.board.credit, 0);
});

test('Negotiated money retains whole manwon input instead of rounding to fourteen-manwon steps', () => {
  const { g, o } = fixture();
  propose(g, o, { salary: 110, signingBonus: 10000 / 1400, years: 2 });
  assert.equal(o.contractTerms.status, 'agreed');
  assert.equal(Math.round(o.contractTerms.signingBonus * 1400), 10000);
});

test('The last manager proposal survives a counteroffer and acceptance without being replaced by board terms', () => {
  const { g, o } = fixture();
  propose(g, o, { salary: 200, signingBonus: 50, years: 3 });
  assert.equal(o.contractTerms.status, 'counter');
  assert.equal(lastManagerProposal(o).salary, 200);
  assert.equal(lastManagerProposal(o).signingBonus, 50);
  assert.notEqual(o.contractTerms.salary, lastManagerProposal(o).salary);
  managerContractAction(g, {
    type: 'acceptManagerTerms',
    id: o.id,
    termsVersion: o.contractTerms.version,
  });
  assert.equal(lastManagerProposal(o).salary, 200);
});
