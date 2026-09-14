import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-scouting-test.cjs');
buildSync({
  stdin: {
    contents: `export * from './tests/fixtures/engine';
      export * from './packages/shared/src/scouting-guide';
      export * from './apps/web/src/features/inbox/report-destination';
      export * from './packages/shared/src/signing-outlook'; export * from './apps/api/src/domain/scouting'; export * from './apps/api/src/domain/free-agent-valuation';`,
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
  createScouting,
  freeAgentValuation,
  scoutingGuide,
  presentScoutingNews,
  reportDestination,
  signingOutlook,
  signingGap,
  signingDemand,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', 'Scouting', 'full', 76);
const scout = (g) => g.staff.find((c) => c.role === '스카우트');
const candidate = (g) => e.marketPlayers(g).find((p) => p.club === 'fa');
const request = (g, p, days = 7) => ({
  type: 'assignScout',
  playerId: p.id,
  scoutId: scout(g).id,
  days,
});

test('Scouting guidance does not announce nonexistent reports and corrects only the old introduction', () => {
  const g = game();
  const guide = g.news.find((n) => n.title === scoutingGuide.title);
  assert.ok(guide);
  assert.equal(guide.report, undefined);
  assert.equal(reportDestination(guide).href, '/?view=scouting&tab=missions');
  assert.ok(!g.news.some((n) => n.title === '스카우팅 리포트 도착'));
  const legacy = {
    ...guide,
    actionView: undefined,
    read: true,
    title: '스카우팅 리포트 도착',
    body: '세계 선수 시장에서 실명 선수와 가상 유망주를 확인할 수 있습니다. 에이전트에게 계약 조건을 제안하세요.',
  };
  const before = structuredClone(legacy);
  const presented = presentScoutingNews(legacy);
  assert.deepEqual(legacy, before);
  assert.equal(presented.id, legacy.id);
  assert.equal(presented.read, true);
  assert.equal(presented.title, guide.title);
  assert.equal(reportDestination(presented).href, '/?view=scouting&tab=missions');
  assert.equal(presented.report, undefined);
  const actualReport = { ...legacy, actionView: 'scouting', report: { players: [] } };
  assert.equal(presentScoutingNews(actualReport), actualReport);
  assert.equal(reportDestination(actualReport).href, '/?view=scouting&tab=reports');
  const otherNews = { ...legacy, kind: 'league' };
  assert.equal(presentScoutingNews(otherNews), otherNews);
});

// The catalog is consulted on assignment and completion, not on each replay event.
test('Scouting adds a saved watchlist and reports only after the observation period', () => {
  let g = game();
  const p = candidate(g),
    before = structuredClone(g);
  g = e.applyAction(g, { type: 'shortlistPlayer', id: p.id, add: true });
  g = e.applyAction(g, { type: 'shortlistPlayer', id: p.id, add: true });
  assert.deepEqual(g.scouting.shortlist, [p.id]);
  g = e.applyAction(g, request(g, p));
  assert.equal(g.scouting.assignments[0].cost, 2);
  assert.equal(g.budget, before.budget - 2);
  assert.deepEqual(g.roster, before.roster);
  assert.equal(g.seed, before.seed);
  for (let i = 0; i < 6; i++) g = e.applyAction(g, { type: 'advance', count: 1 });
  assert.equal(g.scouting.reports.length, 0);
  const lastDay = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  g = lastDay;
  assert.equal(g.scouting.assignments[0].status, 'completed');
  assert.equal(g.scouting.assignments[0].candidateIds, undefined);
  assert.equal(g.scouting.reports.length, 1);
  const r = g.scouting.reports[0];
  assert.equal(r.playerId, p.id);
  assert.ok(r.confidence >= 35 && r.confidence <= 95);
  assert.ok(r.overall[0] <= e.overall(p) && r.overall[1] >= e.overall(p));
  assert.equal(r.potential, undefined);
  assert.equal(r.abilities.potential, undefined);
  assert.ok(
    g.news.some(
      (n) => n.actionView === 'scouting' && n.report?.players?.some((p) => p.id === r.playerId),
    ),
  );
  const reportNews = g.news.find(
    (n) => n.actionView === 'scouting' && n.report?.players?.some((p) => p.id === r.playerId),
  );
  assert.equal(presentScoutingNews(reportNews), reportNews);
  assert.equal(reportNews.scoutAssignmentId, g.scouting.assignments[0].id);
  assert.equal(
    reportDestination(reportNews).href,
    '/?view=scouting&tab=reports&mission=' + encodeURIComponent(reportNews.scoutAssignmentId),
  );
  assert.equal(g.progress.stop, 'report');
  g = e.applyAction(g, { type: 'advance', count: 1 });
  assert.equal(g.scouting.reports.length, 1);
  assert.equal(g.news.filter((n) => n.title.includes('관찰 보고 도착')).length, 1);
  g = e.applyAction(g, { type: 'shortlistPlayer', id: p.id, add: false });
  assert.deepEqual(g.scouting.shortlist, []);
});

test('Scouting rejects invalid targets, duplicate missions, excess workloads and insufficient funds', () => {
  let g = game();
  const p = candidate(g),
    base = structuredClone(g),
    a = request(g, p);
  for (const bad of [
    { ...a, days: 1 },
    { ...a, days: Infinity },
    { ...a, scoutId: 'missing' },
    { ...a, playerId: g.roster[0].id },
    {
      type: 'assignScout',
      league: 'missing',
      scoutId: scout(g).id,
      days: 7,
      pos: 'all',
      maxAge: 25,
    },
  ])
    assert.throws(() => e.applyAction(g, bad));
  assert.deepEqual(g, base);
  const poor = { ...g, budget: 0 };
  assert.throws(() => e.applyAction(poor, a), /예산/);
  g = e.applyAction(g, a);
  assert.throws(() => e.applyAction(g, a), /이미/);
  const others = e
    .marketPlayers(g)
    .filter((x) => x.id !== p.id)
    .slice(0, 3);
  for (const p of others.slice(0, 2)) g = e.applyAction(g, request(g, p));
  assert.throws(() => e.applyAction(g, request(g, others[2])), /세 개/);
  const task = g.scouting.assignments[0],
    balance = g.budget;
  g = e.applyAction(g, { type: 'cancelScout', id: task.id });
  assert.equal(g.budget, balance);
  assert.equal(g.scouting.assignments[0].status, 'cancelled');
  assert.equal(g.scouting.assignments[0].candidateIds, undefined);
  assert.throws(() => e.applyAction(g, { type: 'cancelScout', id: task.id }));
  for (let i = 0; i < 8; i++) g = e.applyAction(g, { type: 'advance', count: 1 });
  assert.ok(!g.scouting.reports.some((r) => r.playerId === task.target.playerId));
});

test('Regional scouting discovers bounded candidates and longer observations improve confidence', () => {
  let g = game();
  const p = candidate(g);
  g = e.applyAction(g, {
    type: 'assignScout',
    league: 'kbo',
    pos: 'P',
    maxAge: 25,
    scoutId: scout(g).id,
    days: 7,
  });
  const task = g.scouting.assignments[0];
  assert.ok(task.candidateIds.length > 0 && task.candidateIds.length <= 3);
  const market = e.marketPlayers(g);
  for (const id of task.candidateIds) {
    const found = market.find((p) => p.id === id);
    assert.equal(found.pos, 'P');
    assert.ok(found.age <= 25);
    assert.notEqual(found.club, g.club);
  }
  for (let i = 0; i < 7; i++) g = e.applyAction(g, { type: 'advance', count: 1 });
  assert.equal(g.scouting.reports.length, task.candidateIds.length);
  let short = game(),
    long = game();
  short = e.applyAction(short, request(short, p, 7));
  long = e.applyAction(long, request(long, p, 28));
  for (let i = 0; i < 28; i++) {
    if (i < 7) short = e.applyAction(short, { type: 'advance', count: 1 });
    long = e.applyAction(long, { type: 'advance', count: 1 });
  }
  assert.ok(long.scouting.reports[0].confidence > short.scouting.reports[0].confidence);
  const old = JSON.parse(JSON.stringify(long));
  assert.deepEqual(
    e.applyAction(old, { type: 'shortlistPlayer', id: p.id, add: true }).scouting.reports,
    long.scouting.reports,
  );
});

test('영입 전망은 기량과 구단 평판 차이로 가능성을 나눈다', () => {
  const g = game();
  const p = candidate(g);
  const easy = signingOutlook({ ...g, reputation: 99, budget: 99999 }, p, 0, 90);
  const hard = signingOutlook({ ...g, reputation: 1, budget: 99999 }, p, 0, 90);
  assert.equal(easy.chance, 'high');
  assert.ok(signingGap({ ...g, reputation: 1 }, p) > signingGap({ ...g, reputation: 99 }, p));
  assert.ok(['high', 'moderate', 'low', 'unlikely'].includes(hard.chance));
  assert.ok(easy.label.length > 0 && hard.reason.length > 0);
});

test('예산으로 감당할 수 없으면 영입 어려움으로 본다', () => {
  const g = game();
  const p = candidate(g);
  const outlook = signingOutlook({ ...g, budget: 0 }, p, 500, 90);
  assert.equal(outlook.affordable, false);
  assert.equal(outlook.chance, 'unlikely');
  assert.match(outlook.reason, /예산/);
});

test('신뢰도가 낮을수록 기대 연봉 구간이 넓어진다', () => {
  const g = { ...game(), budget: 99999 };
  // 기대 연봉 하한(5) 근처에서는 반올림 때문에 구간이 같아진다. 연봉 규모가 있는
  // 선수로 확인한다.
  const p = { ...candidate(g), salary: 200 };
  const sure = signingOutlook(g, p, 0, 95);
  const vague = signingOutlook(g, p, 0, 35);
  const span = (o) => o.demand[1] - o.demand[0];
  assert.ok(span(vague) > span(sure), `${span(vague)} > ${span(sure)}`);
  const demand = signingDemand(g, p);
  assert.ok(
    sure.demand[0] <= demand && sure.demand[1] >= demand,
    '실제 기대 연봉을 구간에 담아야 한다',
  );
});

test('도착한 스카우트 보고서와 뉴스에 영입 전망이 담긴다', () => {
  let g = game();
  const p = candidate(g);
  g = e.applyAction(g, request(g, p));
  for (let i = 0; i < 6; i++) g = e.applyAction(g, { type: 'advance', count: 1 });
  g = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  const r = g.scouting.reports[0];
  assert.ok(r.signing, '보고서에 영입 전망이 있어야 한다');
  assert.ok(r.signing.demand[0] <= r.signing.demand[1]);
  assert.equal(typeof r.signing.affordable, 'boolean');
  assert.ok(r.signing.reason.length > 0);
  const news = g.news.find(
    (n) => n.actionView === 'scouting' && n.report?.players?.some((x) => x.id === r.playerId),
  );
  assert.ok(news, '스카우트 뉴스를 찾아야 한다');
  assert.ok(
    news.report.players.some((x) => x.detail.includes(r.signing.label)),
    '요약 줄에 전망이 보여야 한다',
  );
  const section = news.report.sections.find((x) => x.title === r.playerName);
  assert.ok(section);
  assert.ok(section.body.includes(r.signing.label), '본문에 전망이 보여야 한다');
  assert.ok(section.body.includes(r.signing.reason), '본문에 근거가 보여야 한다');
  assert.match(section.body, /기대 연봉/);
  assert.match(section.body, /예산/);
});

test('FA 관찰 보고는 전년도 성적을 반영한 협상 평가액을 사용한다', () => {
  let g = game();
  const p = candidate(g);
  const previous = { ...p.stats, ab: 400, h: 160, hr: 35, outs: 300, er: 20 };
  g = e.applyAction(g, request(g, p));
  g.scouting.assignments[0].due = '2000-01-01';
  const salary = freeAgentValuation(g, p, 'kbo', previous).salary;
  createScouting(world, { [p.id]: previous }).tick(g);
  const report = g.scouting.reports.find((r) => r.playerId === p.id);
  assert.deepEqual(
    report.signing.demand,
    signingOutlook(g, p, 0, report.confidence, salary).demand,
  );
  assert.deepEqual(
    signingOutlook(g, { ...p, salary: 99999 }, 0, 95, salary).demand,
    signingOutlook(g, { ...p, salary: 1 }, 0, 95, salary).demand,
  );
});
