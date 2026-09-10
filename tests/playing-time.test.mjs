import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
function bundle(path, name) {
  const outfile = join(tmpdir(), `dugout-playing-time-${name}.cjs`);
  buildSync({ entryPoints: [path], bundle: true, platform: 'node', format: 'cjs', outfile });
  return require(outfile);
}
const { engine: e, world } = bundle('tests/fixtures/engine.ts', 'engine');
const { playingTimeAssessment } = bundle('packages/shared/src/playing-time.ts', 'assessment');
const { dailyReports, matchMorale } = bundle('apps/api/src/domain/club-dynamics.ts', 'dynamics');
function career() {
  return e.newGame('kbo-lotte', '출전 검증', 'short', 21, { preseason: false });
}
test('Low morale from defeats does not make regularly used batters ask for playing time', () => {
  const g = career(),
    p = g.roster.find((p) => p.id === g.lineup[0]);
  p.mood.value = 20;
  p.mood.recent = Array(12).fill(true);
  p.mood.reason = '연패';
  dailyReports(g, world);
  assert.ok(!g.news.some((n) => n.playerId === p.id && n.choiceKind));
  p.mood.recent = Array(12).fill(false);
  dailyReports(g, world);
  const news = g.news.find((n) => n.playerId === p.id && n.choiceKind);
  assert.match(news.body, /12경기 중 0경기 출전/);
  assert.match(news.body, /기준/);
});
test('Pitcher roles, fatigue, reserves, injuries and insufficient samples do not create false demands', () => {
  const g = career(),
    p = g.roster.find((p) => p.id === g.pitching.rotation[0]);
  p.mood.recent = [true, true, ...Array(10).fill(false)];
  assert.equal(playingTimeAssessment(g, p).shortage, false);
  const closer = g.roster.find((p) => p.id === g.pitching.closer);
  closer.mood.recent = Array(12).fill(false);
  assert.equal(playingTimeAssessment(g, closer), null);
  const batter = g.roster.find((p) => p.id === g.lineup[0]);
  batter.mood.recent = Array(12).fill(false);
  for (const change of [
    { condition: 50 },
    { squad: 'reserve' },
    { injury: { phase: 'treatment' } },
  ])
    assert.equal(playingTimeAssessment(g, { ...batter, ...change }), null);
  assert.equal(
    playingTimeAssessment(g, { ...batter, mood: { ...batter.mood, recent: [false] } }),
    null,
  );
});
test('Relievers, pinch hitters and defensive replacements count as actual appearances', () => {
  const g = career(),
    pitcher = g.pitching.bullpen.find((id) => id !== g.starter),
    bench = g.roster.find(
      (p) => p.squad !== 'reserve' && p.pos !== 'P' && !g.lineup.includes(p.id),
    );
  const res = {
    home: g.club,
    away: 'kbo-lg',
    homeScore: 1,
    awayScore: 2,
    log: [{ play: { batter: bench.id, pitcher, defense: { C: bench.id } } }],
    replayTeams: [
      { lineup: [], defense: { P: 'opponent' } },
      { lineup: g.lineup, defense: { P: g.starter } },
    ],
  };
  matchMorale(g, res);
  assert.equal(g.roster.find((p) => p.id === pitcher).mood.recent.at(-1), true);
  assert.equal(bench.mood.recent.at(-1), true);
});
test('Unsupported existing playing-time decisions are resolved without creating a promise or changing morale', () => {
  const g = career(),
    p = g.roster.find((p) => p.id === g.lineup[0]);
  p.mood.value = 30;
  p.mood.recent = Array(12).fill(true);
  g.news.unshift({
    id: 'old-unfair-demand',
    day: 0,
    title: '감독 면담 요청',
    body: '사기가 낮음',
    kind: 'morale',
    playerId: p.id,
    choiceKind: 'playingTime',
  });
  const next = e.applyAction(g, { type: 'readAllNews' });
  assert.equal(next.news.find((n) => n.id === 'old-unfair-demand').choice, 'resolved');
  assert.equal(next.roster.find((x) => x.id === p.id).mood.value, 30);
  assert.equal(next.roster.find((x) => x.id === p.id).mood.promise, undefined);
  assert.equal(g.news[0].choice, undefined);
});
