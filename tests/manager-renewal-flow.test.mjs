import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-manager-renewal-flow.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';export * from './packages/shared/src/manager-departure';export * from './apps/api/src/domain/manager-contracts';export * from './apps/web/src/features/career/manager-flow';",
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
  gameDate,
  addDays,
  daysBetween,
  prepareManagerTerms,
  managerStep,
  departureLabel,
  departureDetail,
} = createRequire(import.meta.url)(out);
function game() {
  const g = e.newGame('kbo-kia', 'Renewal manager', 'short', 45, { preseason: false });
  g.news = [];
  g.day = g.rounds;
  Object.assign(
    g.standings.kbo.find((s) => s.club === g.club),
    { w: 100, l: 40 },
  );
  return g;
}
for (const boundary of [false, true])
  test(`Finished-season renewal can receive a reply, sign and advance${boundary ? ' at the next opening boundary' : ''}`, () => {
    let g = game();
    g.phase = 'finished';
    g.champion = g.club;
    if (boundary) g.day = daysBetween(gameDate(g, 0), `${g.year + 1}-03-27`);
    const c = g.managerCareer.contract;
    c.throughYear = g.year;
    c.reviewedYear = g.year;
    c.targetRank = 1;
    const offer = {
      id: 'renewal-test',
      club: g.club,
      source: 'renewal',
      salary: c.salary * 1.15,
      targetRank: 1,
      applied: gameDate(g),
      due: gameDate(g),
      expires: addDays(gameDate(g), 14),
      status: 'offered',
      message: '재계약',
    };
    prepareManagerTerms(offer);
    g.managerCareer.offers = [offer];
    g = e.applyAction(g, {
      type: 'negotiateManagerContract',
      id: offer.id,
      termsVersion: 1,
      salary: offer.salary * 1.05,
      signingBonus: 0,
      years: 1,
      targetRank: 1,
    });
    assert.equal(managerStep(g, false, 'inbox').kind, 'contractReply');
    assert.throws(() => e.applyAction(g, { type: 'nextSeason' }), /재계약/);
    const year = g.year,
      day = g.day;
    g = e.applyAction(g, { type: 'managerContinue', count: 1 });
    assert.equal(g.day, day + 1);
    assert.equal(g.year, year);
    assert.equal(g.phase, 'finished');
    const agreed = g.managerCareer.offers.find((o) => o.id === offer.id);
    assert.equal(agreed.contractTerms.status, 'agreed');
    g.news.forEach((n) => (n.read = true));
    assert.equal(managerStep(g, false, 'inbox').kind, 'contract');
    g = e.applyAction(g, {
      type: 'signManager',
      id: offer.id,
      termsVersion: agreed.contractTerms.version,
      signature: g.manager,
    });
    g = e.applyAction(g, { type: 'nextSeason' });
    assert.equal(g.year, year + 1);
  });

test('Declining renewal preserves the closing rank and ends employment before new-season club duties', () => {
  let g = game();
  g.phase = 'finished';
  g.champion = g.club;
  g.managerCareer.contract.throughYear = g.year;
  g.managerCareer.contract.reviewedYear = g.year;
  g.managerJobs[g.club].confidence = 82;
  g.managerCareer.offers = [
    {
      id: 'declined-renewal',
      club: g.club,
      source: 'renewal',
      status: 'offered',
      salary: 5,
      targetRank: 3,
      applied: gameDate(g),
      due: gameDate(g),
      expires: `${g.year + 1}-03-27`,
      message: '재계약',
    },
  ];
  g = e.applyAction(g, { type: 'declineManager', id: 'declined-renewal' });
  assert.equal(g.managerCareer.status, 'employed');
  g = e.applyAction(g, { type: 'nextSeason' });
  const h = g.managerCareer.history[0];
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.equal(g.managerCareer.contract, undefined);
  assert.equal(h.rank, 1);
  assert.equal(h.confidence, 82);
  assert.equal(h.endKind, 'nonrenewal');
  assert.equal(departureLabel(h), '계약 만료 · 재계약 불발');
  assert.doesNotMatch(departureDetail(g, { ...h, detail: undefined }), /사퇴/);
  assert.ok(g.news.some((n) => n.title === '감독 계약 만료 · 재계약 없이 퇴임했습니다'));
  assert.ok(!g.news.some((n) => n.title === '감독직에서 사퇴했습니다'));
  const opening = g.news.find((n) => n.title === `${g.year} 시즌 시작`);
  assert.equal(opening.actionView, 'jobs');
  assert.doesNotMatch(opening.body, /지명하세요/);
  assert.throws(() => e.applyAction(g, { type: 'startMatch' }), /무직/);
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  assert.equal(g.managerCareer.history.length, 1);
  assert.equal(g.managerCareer.history[0].rank, 1);
});

test('A continuing multi-season contract keeps the new-season draft route and voluntary resignation stays distinct', () => {
  let g = game();
  g.phase = 'finished';
  g.managerCareer.contract.throughYear = g.year + 1;
  g = e.applyAction(g, { type: 'nextSeason' });
  assert.equal(g.managerCareer.status, 'employed');
  assert.equal(g.managerCareer.history.length, 0);
  assert.equal(g.news.find((n) => n.title === `${g.year} 시즌 시작`).actionView, 'draft');
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  assert.equal(departureLabel(g.managerCareer.history[0]), '사퇴');
  assert.ok(g.news.some((n) => n.title === '감독직에서 사퇴했습니다'));
});
