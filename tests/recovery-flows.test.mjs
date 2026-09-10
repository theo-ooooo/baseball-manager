import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-recovery-flows.cjs');
buildSync({
  stdin: {
    contents: `export * from './tests/fixtures/career-systems';
      export * from './apps/api/src/domain/club-dynamics';
      export * from './apps/api/src/domain/lineup-reports';
      export * from './apps/api/src/domain/recruitment';
      export * from './apps/api/src/domain/season-rest';
      export * from './packages/shared/src/season-status';
      export * from './packages/shared/src/training-center';
      export * from './packages/shared/src/contract-status';
      export * from './packages/shared/src/manager-departure';
      export * from './apps/web/src/features/inbox/inbox-model';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
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
  dailyReports,
  createLineupReports,
  prepareSeasonRest,
  clubSeasonStatus,
  isClubSeasonRest,
  trainingDay,
  defaultTrainingCenter,
  gameDate,
  createRecruitment,
  needsContractReview,
  contractReportStatus,
  newsNeedsAction,
  departureDetail,
  postNews,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', '흐름 검증', 'short', 436, { preseason: false });

test('An eliminated club rests both squads despite saved training plans, freezes promises and receives no deployment reports', () => {
  const g = game();
  g.phase = 'semifinal';
  g.series = [{ a: 'kbo-lg', b: 'kbo-kia', aw: 0, bw: 0 }];
  g.day = 28;
  assert.equal(clubSeasonStatus(g).label, '우리 팀 시즌 종료');
  g.trainingCenter = defaultTrainingCenter();
  g.trainingCenter.responsibility = 'manager';
  for (const squad of ['first', 'reserve']) {
    g.trainingCenter.programs[squad].days[gameDate(g)] = ['power', 'general', 'pitching'];
    const day = trainingDay(g, squad, gameDate(g), true, true);
    assert.deepEqual(day.slots, ['rest', 'rest', 'rest']);
    assert.equal(day.match, false);
  }
  const p = g.roster[0];
  p.mood.value = 30;
  p.mood.recent = Array(12).fill(false);
  p.mood.promise = { due: g.day, startGames: p.stats.g, games: 3 };
  g.news = [
    {
      id: 'pending',
      year: g.year,
      day: 26,
      playerId: p.id,
      title: '출전 면담',
      body: '기용 요청',
      kind: 'morale',
      choiceKind: 'playingTime',
    },
  ];
  g.coachRecommendations = [{ id: 'old', playerId: p.id, status: 'pending' }];
  prepareSeasonRest(g);
  assert.equal(g.coachRecommendations[0].status, 'dismissed');
  assert.equal(newsNeedsAction(g.news[0], g), false);
  const morale = p.mood.value;
  dailyReports(g, world);
  coachReports(g);
  createLineupReports(world).prepare(g);
  assert.equal(p.mood.promise.due, g.day + 1);
  assert.equal(p.mood.value, morale);
  assert.ok(
    !g.news.some((n) => ['lineup', 'training'].includes(n.kind) || n.title.includes('불이행')),
  );
  g.series = [{ a: g.club, b: 'kbo-lg', aw: 0, bw: 2 }];
  assert.equal(isClubSeasonRest(g), true);
  g.series[0].bw = 1;
  assert.equal(isClubSeasonRest(g), false);
  g.phase = 'regular';
  assert.equal(isClubSeasonRest(g), false);
  assert.notDeepEqual(trainingDay(g, 'first', gameDate(g), false, false).slots, [
    'rest',
    'rest',
    'rest',
  ]);
});

test('A signed one-year renewal is resolved in old reports and does not request another renewal that season', () => {
  let g = game();
  const p = g.roster.find((p) => p.years === 1);
  assert.ok(p);
  const recruit = createRecruitment(world);
  g = recruit.negotiate(g, p.id, p.salary * 2, 1, 'renew');
  const deal = g.deals[0];
  deal.status = 'accepted';
  deal.expires = g.day + 7;
  g.news.unshift({
    id: 'reply',
    year: g.year,
    day: g.day,
    title: '서명 요청',
    body: '서명해 주세요.',
    kind: 'transfer',
    dealId: deal.id,
    playerId: p.id,
  });
  g = recruit.signDeal(g, deal.id);
  const current = g.roster.find((x) => x.id === p.id);
  assert.equal(current.years, 1);
  assert.equal(current.contractSigned.year, g.year);
  assert.equal(needsContractReview(g, current), false);
  const reply = g.news.find((n) => n.id === 'reply');
  assert.equal(contractReportStatus(g, reply), 'signed');
  assert.equal(newsNeedsAction(reply, g), false);
  const legacy = structuredClone(g);
  delete legacy.roster.find((x) => x.id === p.id).contractSigned;
  assert.equal(
    needsContractReview(
      legacy,
      legacy.roster.find((x) => x.id === p.id),
    ),
    false,
  );
  assert.throws(() => recruit.signDeal(g, deal.id));
  g.year++;
  assert.equal(needsContractReview(g, current), true);
});

test('Dismissal and nonrenewal explain their exact trigger, close club mail and preserve the reason after time advances', () => {
  const career = createManagerCareer(world);
  let g = game();
  g.managerCareer.contract.targetRank = 1;
  g.standings.kbo.find((s) => s.club !== g.club).w = 20;
  g.phase = 'finished';
  g.news.unshift({
    id: 'renew',
    kind: 'contract',
    title: '재계약',
    body: '요청',
    year: g.year,
    day: g.day,
    read: false,
  });
  career.review(g);
  assert.equal(g.managerCareer.status, 'unemployed');
  const h = g.managerCareer.history[0];
  assert.equal(h.endKind, 'nonrenewal');
  assert.match(h.detail, /계약 목표 1위 이내 미달/);
  assert.match(h.detail, /재계약하지 않습니다/);
  assert.ok(g.news.some((n) => n.body.includes(h.detail)));
  assert.equal(g.news.find((n) => n.id === 'renew').read, true);
  assert.equal(g.news.find((n) => n.id === 'renew').employmentClosed, true);
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  assert.equal(departureDetail(g, g.managerCareer.history[0]), h.detail);
  const before = g.news.length;
  postNews(g, '전 소속 구단 재계약 요청', '새 연락', 'contract');
  dailyReports(g, world);
  coachReports(g);
  createRecruitment(world).tick(g);
  assert.equal(g.news.length, before);
  assert.ok(
    !g.news
      .filter((n) => n.kind !== 'manager' && n.kind !== 'league')
      .some((n) => newsNeedsAction(n, g)),
  );
  const legacy = game();
  legacy.managerCareer.status = 'unemployed';
  legacy.news.push({
    id: 'stale',
    kind: 'transfer',
    title: '선수 협상',
    body: '서명',
    day: legacy.day,
  });
  career.prepare(legacy);
  assert.equal(legacy.news.find((n) => n.id === 'stale').read, true);
  const midseason = game();
  const row = midseason.standings.kbo.find((s) => s.club === midseason.club);
  row.l = 40;
  career.tick(midseason);
  assert.equal(midseason.managerCareer.history[0].endKind, 'dismissal');
  assert.match(midseason.managerCareer.history[0].detail, /0승 40패/);
  assert.match(midseason.managerCareer.history[0].detail, /15% 미만/);
  assert.equal(midseason.managerCareer.history[0].confidence, 5);
});
