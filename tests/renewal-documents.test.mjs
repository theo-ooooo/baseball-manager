import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './apps/api/src/domain/recruitment'; export * from './apps/api/src/domain/free-agent-valuation'; export * from './packages/shared/src/contract-status';",
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
  createRecruitment,
  freeAgentValuation,
  renewalUnavailableReason,
  playerDealPeriod,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
function ready() {
  const g = e.newGame('kbo-lotte', '재계약 검증', 'short', 954, { preseason: false });
  g.roster.forEach((p) => {
    p.years = 1;
    delete p.contractSigned;
  });
  return g;
}
const offer = (p) => ({ id: p.id, salary: p.salary * 2, years: 3 });
test('Batch renewal keeps every active offer beyond the old 30-deal limit and spends only after individual signing', () => {
  const g = ready(),
    r = createRecruitment(world);
  const selected = g.roster.slice(0, 40);
  assert.equal(selected.length, 40);
  r.negotiate(g, g.roster[40].id, g.roster[40].salary * 2, 3, 'renew');
  const prior = structuredClone(g);
  const next = e.applyAction(g, { type: 'renewContracts', offers: selected.map(offer) });
  assert.equal(next.deals.length, 41);
  assert.ok(next.deals.every((d) => d.status === 'pending'));
  assert.deepEqual(next.roster, prior.roster);
  assert.equal(next.budget, prior.budget);
  assert.deepEqual(g, prior);
  next.day += 2;
  r.tick(next);
  const deal = next.deals.find((d) => d.player.id === selected[0].id);
  assert.equal(deal.status, 'accepted');
  r.signDeal(next, deal.id);
  const signed = next.roster.find((p) => p.id === selected[0].id);
  assert.equal(signed.salary, deal.salary);
  assert.equal(signed.years, 4);
  assert.equal(next.budget, prior.budget - deal.salary * 0.05 - deal.agentFee);
  assert.throws(() => r.negotiate(next, signed.id, signed.salary, 3, 'renew'), /이미 계약/);
  assert.equal(next.deals.length, 40);
});
test('Invalid, stale, duplicate, already signed and over-budget batches are atomic', () => {
  const g = ready(),
    r = createRecruitment(world),
    [a, b] = g.roster;
  const before = structuredClone(g);
  for (const offers of [
    [],
    [offer(a), offer(a)],
    [offer(a), { ...offer(b), years: 6 }],
    [offer(a), { id: 'foreign', salary: 30, years: 2 }],
    [offer(a), { ...offer(b), salary: 1e8 }],
  ]) {
    assert.throws(() => r.action(g, { type: 'renewContracts', offers }));
    assert.deepEqual(g, before);
  }
  r.negotiate(g, b.id, b.salary, 3, 'renew');
  const pending = structuredClone(g);
  assert.throws(
    () => r.action(g, { type: 'renewContracts', offers: [offer(a), offer(b)] }),
    /진행 중/,
  );
  assert.deepEqual(g, pending);
  a.contractSigned = { year: g.year, day: g.day, dealId: 'completed' };
  assert.ok(renewalUnavailableReason(g, a));
  assert.throws(() => r.action(g, { type: 'renewContracts', offers: [offer(a)] }), /계약을 마쳤/);
  g.managerCareer.status = 'unemployed';
  assert.throws(() => e.applyAction(g, { type: 'renewContracts', offers: [offer(a)] }), /무직/);
});
test('FA demand ignores prior pay and hidden potential, reflects age, recent performance and destination league', () => {
  const g = ready(),
    p = structuredClone(g.roster.find((p) => p.pos !== 'P'));
  p.club = 'fa';
  p.age = 28;
  p.contact = p.power = p.field = p.speed = 70;
  p.stats = { g: 40, ab: 150, h: 45, hr: 6, rbi: 25, bb: 10, k: 20, outs: 0, er: 0, wins: 0 };
  const terms = freeAgentValuation(g, p, 'kbo');
  assert.deepEqual(freeAgentValuation(g, { ...p, salary: 0.01, potential: 1 }, 'kbo'), terms);
  assert.deepEqual(freeAgentValuation(g, { ...p, salary: 1e7, potential: 99 }, 'kbo'), terms);
  assert.ok(freeAgentValuation(g, { ...p, age: 38 }, 'kbo').salary < terms.salary);
  assert.ok(
    freeAgentValuation(g, { ...p, stats: { ...p.stats, h: 25, hr: 1 } }, 'kbo').salary <
      terms.salary,
  );
  assert.ok(freeAgentValuation(g, p, 'mlb').salary > terms.salary);
  assert.ok(freeAgentValuation(g, { ...p, contact: 80, power: 80 }, 'kbo').salary > terms.salary);
  assert.equal(freeAgentValuation(g, { ...p, age: 36 }, 'kbo').years, 1);
});

test('One-year and three-year renewals survive the next opening day and expire only after the agreed full seasons', () => {
  let g = ready();
  const r = createRecruitment(world);
  const [one, three, old] = g.roster;
  for (const p of g.roster) p.age = 24;
  g.managerCareer.contract.throughYear = 2040;
  g.managerCareer.offers = [];
  g = e.applyAction(g, {
    type: 'renewContracts',
    offers: [
      { ...offer(one), years: 1 },
      { ...offer(three), years: 3 },
    ],
  });
  // Isolate the signing/expiry boundary from the agent's preference for a longer offer.
  for (const deal of [...g.deals]) {
    deal.status = 'accepted';
    r.signDeal(g, deal.id);
  }
  assert.equal(g.roster.find((p) => p.id === one.id).years, 2);
  assert.equal(g.roster.find((p) => p.id === three.id).years, 4);
  const budgetAfterSigning = g.budget;
  assert.throws(() => r.signDeal(g, `missing`));
  assert.equal(g.budget, budgetAfterSigning);
  for (let n = 1; n <= 4; n++) {
    g.phase = 'finished';
    g.champion = g.club;
    g = e.nextSeason(g);
    assert.equal(g.year, 2026 + n);
    assert.equal(g.roster.find((p) => p.id === one.id)?.years, n === 1 ? 1 : undefined);
    assert.equal(g.roster.find((p) => p.id === three.id)?.years, n < 4 ? 4 - n : undefined);
    assert.equal(
      g.roster.some((p) => p.id === old.id),
      false,
    );
  }
});

test('Renewal papers describe following seasons while a new FA contract still starts in the signing season', () => {
  assert.deepEqual(playerDealPeriod(2026, 'renew', 1), {
    startYear: 2027,
    endYear: 2027,
    remainingYears: 2,
  });
  assert.deepEqual(playerDealPeriod(2026, 'renew', 3), {
    startYear: 2027,
    endYear: 2029,
    remainingYears: 4,
  });
  assert.deepEqual(playerDealPeriod(2026, 'buy', 1), {
    startYear: 2026,
    endYear: 2026,
    remainingYears: 1,
  });
});
