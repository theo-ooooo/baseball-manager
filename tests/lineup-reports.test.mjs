import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-lineup-report-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './apps/api/src/domain/lineup-reports'; export * from './apps/api/src/domain/lineup-rotation'; export * from './packages/shared/src/lineup-recommendation'; export * from './packages/shared/src/calendar';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
});
const {
  engine: e,
  world,
  createLineupReports,
  lineupRecommendationError,
  gameDate,
  rotateLineup,
} = createRequire(import.meta.url)(output);
const setup = () => e.newGame('kbo-lotte', '추천 검증', 'full', 72, { preseason: false });
const latest = (g) => g.news.find((n) => n.lineupRecommendation);
test('Coaches share starts between comparable same-position players while preserving pitcher order and strong mismatches', () => {
  const g = setup();
  g.staff.find((c) => c.role === '타격').skill = 100;
  const base = g.roster.find((p) => p.id === g.lineup[0]);
  const player = (id, pos, played, ability = 60) => ({
    ...structuredClone(base),
    id,
    pos,
    squad: 'first',
    condition: 100,
    contact: ability,
    power: ability,
    field: ability,
    speed: ability,
    mood: { ...base.mood, recent: Array.from({ length: 12 }, (_, i) => i < played) },
  });
  const regular = player('regular', 'C', 12),
    reserve = player('underused', 'C', 0),
    star = player('star', 'OF', 12, 90),
    weak = player('weak', 'OF', 0, 40);
  const before = structuredClone(g.pitching),
    result = rotateLineup(g, [regular, reserve, star, weak], ['regular', 'star']);
  assert.deepEqual(result.ids, ['underused', 'star']);
  assert.equal(result.changes[0].recent, 0);
  assert.deepEqual(g.pitching, before);
  assert.deepEqual(rotateLineup(g, [regular, { ...reserve, condition: 60 }], ['regular']).ids, [
    'regular',
  ]);
  assert.deepEqual(
    rotateLineup(g, [regular, { ...reserve, injury: { phase: 'treatment' } }], ['regular']).ids,
    ['regular'],
  );
  assert.deepEqual(rotateLineup(g, [regular, { ...reserve, pos: 'IF' }], ['regular']).ids, [
    'regular',
  ]);
  assert.deepEqual(rotateLineup(g, [regular, reserve, star, weak], ['regular', 'star']), result);
});
test('A coach sends one report per upcoming game and applies nine eligible batters plus starter atomically without roster moves', () => {
  let g = setup();
  const reports = createLineupReports(world);
  const news = latest(g);
  assert.ok(news);
  assert.equal(news.report.players.length, 9);
  assert.equal(new Set(news.lineupRecommendation.ids).size, 9);
  assert.equal(news.lineupRecommendation.date, gameDate(g));
  assert.equal(g.news.filter((n) => n.lineupRecommendation).length, 1);
  reports.prepare(g);
  reports.prepare(g);
  assert.equal(g.news.filter((n) => n.lineupRecommendation).length, 1);
  const roster = g.roster.map((p) => ({ id: p.id, squad: p.squad })),
    funds = g.budget,
    order = g.lineup.slice();
  assert.equal(news.lineupRecommendation.status, 'pending');
  assert.deepEqual(g.lineup, order);
  g = e.applyAction(g, { type: 'lineupRecommendation', id: news.id, choice: 'apply' });
  assert.deepEqual(g.lineup, news.lineupRecommendation.ids);
  assert.equal(g.starter, news.lineupRecommendation.starter);
  assert.equal(new Set(Object.values(g.defense)).size, 10);
  assert.deepEqual(
    g.roster.map((p) => ({ id: p.id, squad: p.squad })),
    roster,
  );
  assert.equal(g.budget, funds);
  assert.equal(latest(g).lineupRecommendation.status, 'applied');
  assert.throws(
    () => e.applyAction(g, { type: 'lineupRecommendation', id: news.id, choice: 'apply' }),
    /적용 완료/,
  );
});
test('A stale report cannot promote reserves, play injured batters, or replace an already started game; refresh re-evaluates current players', () => {
  let g = setup();
  const reports = createLineupReports(world),
    news = latest(g),
    id = news.lineupRecommendation.ids[0];
  const p = g.roster.find((p) => p.id === id);
  p.squad = 'reserve';
  const prior = JSON.stringify(g);
  assert.throws(
    () => e.applyAction(g, { type: 'lineupRecommendation', id: news.id, choice: 'apply' }),
    /등록·부상/,
  );
  assert.equal(JSON.stringify(g), prior);
  reports.prepare(g, true);
  assert.ok(!latest(g).lineupRecommendation.ids.includes(id));
  assert.equal(g.news.filter((n) => n.lineupRecommendation).length, 1);
  const selected = g.roster.find((p) => p.id === latest(g).lineupRecommendation.ids[0]);
  selected.injury = { name: '검증 부상', phase: 'treatment' };
  assert.match(lineupRecommendationError(g, latest(g)), /등록·부상/);
  g.liveMatch = {};
  assert.match(lineupRecommendationError(g, latest(g)), /경기 진행/);
  delete g.liveMatch;
  g.day += 2;
  assert.match(lineupRecommendationError(g, latest(g)), /지난 경기/);
});
test('Coach fatigue advice rests first-team batters without demotion and preserves manager choice when dismissed', () => {
  let g = setup();
  const reports = createLineupReports(world),
    tired = g.roster.find((p) => p.id === g.lineup[0]);
  tired.condition = 35;
  reports.prepare(g, true);
  const n = latest(g);
  assert.ok(!n.lineupRecommendation.ids.includes(tired.id));
  assert.match(n.report.sections.map((s) => s.body).join('\n'), /1군을 유지하며 선발 휴식/);
  assert.equal(tired.squad, 'first');
  const order = g.lineup.slice();
  g = e.applyAction(g, { type: 'lineupRecommendation', id: n.id, choice: 'dismiss' });
  assert.deepEqual(g.lineup, order);
  assert.equal(latest(g).lineupRecommendation.status, 'dismissed');
  const unemployed = e.newGame('kbo-lg', '무직', 'full', 3, { preseason: false, unemployed: true });
  reports.prepare(unemployed);
  assert.equal(latest(unemployed), undefined);
});
test('The second game of a doubleheader remains actionable after the first game against the same opponent', () => {
  const g = setup(),
    n = latest(g),
    r = n.lineupRecommendation;
  g.history.push({ fixtureId: 'earlier-fixture', date: r.date, home: g.club, away: r.opponent });
  assert.equal(lineupRecommendationError(g, n), null);
  g.history.push({ fixtureId: r.fixture, date: r.date, home: g.club, away: r.opponent });
  assert.match(lineupRecommendationError(g, n), /지난 경기/);
});
