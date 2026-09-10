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
  scoutingGuide,
  presentScoutingNews,
  reportDestination,
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
  assert.equal(reportDestination(reportNews).href, '/?view=scouting&tab=reports');
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
