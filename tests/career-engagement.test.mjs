import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-career-engagement.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';export * from './packages/shared/src/career-pace';export * from './packages/shared/src/series-delegation';export * from './packages/shared/src/career-engagement';export * from './packages/shared/src/match-highlights';export * from './apps/api/src/domain/career-engagement';export * from './apps/api/src/domain/career-challenge';export * from './apps/api/src/domain/calendar-progression';export * from './apps/web/src/features/career/manager-flow';",
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
  gameDate,
  createCalendarView,
  managerStep,
  createCalendarProgression,
  recordEngagementMatch,
  matchStakes,
  tickChallenge,
  seriesDelegationDecision,
  highlightCursor,
} = createRequire(import.meta.url)(out);
function game() {
  const g = e.newGame('kbo-lotte', 'Fun career', 'short', 32, { preseason: false });
  g.news = [];
  g.weather.seed = 0;
  return g;
}

test('Unread routine reports stop matchday even in important-only mode; required decisions keep priority', () => {
  const g = game();
  g.news = [
    { id: 'routine', title: 'Training', body: 'Report', kind: 'training', day: 0, read: false },
  ];
  const saved = structuredClone(g);
  assert.equal(managerStep(g, true, 'home').kind, 'report');
  assert.equal(managerStep(g, true, 'home').reportId, 'routine');
  assert.equal(managerStep(g, false, 'home').kind, 'continue');
  assert.deepEqual(g, saved);
  g.engagement.reportMode = 'all';
  assert.equal(managerStep(g, true, 'home').kind, 'report');
  g.engagement.reportMode = 'important';
  g.news.push({
    id: 'injury',
    title: 'Injury',
    body: 'Report',
    kind: 'medical',
    actionView: 'medical',
    day: 0,
  });
  assert.equal(managerStep(g, true, 'home').reportId, 'injury');
  g.news.at(-1).read = true;
  g.news.push({
    id: 'choice',
    title: 'Promise',
    body: 'Decision',
    kind: 'morale',
    choiceKind: 'playingTime',
    day: 0,
    read: true,
  });
  assert.equal(managerStep(g, true, 'home').kind, 'decision');
});
test('Date progression crosses routine mail but stops for new medical decisions without marking routine mail read', () => {
  const g = game();
  const p = createCalendarProgression(
    (s) => (s.day === 3 ? ['a', 'b'] : null),
    (s) => {
      s.day++;
      s.news.push({ id: `n${s.day}`, day: s.day, title: 'Routine', body: '', kind: 'training' });
      return s;
    },
  );
  p.untilEvent(g);
  assert.equal(g.day, 3);
  assert.equal(g.progress.stop, 'fixture');
  assert.ok(g.news.every((n) => !n.read));
  const h = game();
  const urgent = createCalendarProgression(
    () => null,
    (s) => {
      s.day++;
      s.news.push({
        id: 'medical',
        day: s.day,
        title: 'Injury',
        body: '',
        kind: 'medical',
        actionView: 'medical',
      });
      return s;
    },
  );
  urgent.untilEvent(h);
  assert.equal(h.day, 1);
  assert.equal(h.progress.stop, 'report');
});
test('Prospect selection validates age, position and the three-player limit; reselecting keeps progress and the original goal', () => {
  let g = game();
  const players = g.roster.filter((p) => p.pos !== 'P').slice(0, 4);
  players.forEach((p) => (p.age = 21));
  for (const p of players.slice(0, 3))
    g = e.applyAction(g, { type: 'followProspect', id: p.id, goal: 'hits' });
  assert.throws(
    () => e.applyAction(g, { type: 'followProspect', id: players[3].id, goal: 'hits' }),
    /세 명/,
  );
  assert.throws(
    () => e.applyAction(g, { type: 'followProspect', id: players[0].id, goal: 'strikeouts' }),
    /포지션/,
  );
  g.engagement.prospects[0].hits = 4;
  g = e.applyAction(g, { type: 'unfollowProspect', id: players[0].id });
  g = e.applyAction(g, { type: 'followProspect', id: players[0].id, goal: 'homer' });
  assert.equal(g.engagement.prospects[0].hits, 4);
  assert.equal(g.engagement.prospects[0].goal, 'hits');
});
test('Actual game appearances create a prospect story, a completed goal rewards once and replaying does not duplicate it', () => {
  let g = game();
  const id = g.lineup[0];
  g.roster.find((p) => p.id === id).age = 21;
  g = e.applyAction(g, { type: 'followProspect', id, goal: 'starts' });
  g = e.applyAction(g, { type: 'startMatch' });
  const result = g.liveMatch.timeline;
  g = e.applyAction(g, {
    type: 'completeMatch',
    cursor: result.log.length,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  assert.equal(g.engagement.prospects[0].starts, 1);
  assert.ok(g.history[0].story.moments.some((m) => m.playerId === id));
  const saved = structuredClone(g);
  recordEngagementMatch(g, g.history[0]);
  assert.deepEqual(g, saved);
  for (const n of [2, 3])
    recordEngagementMatch(g, { ...result, id: `goal-${n}`, date: gameDate(g), friendly: false });
  const story = g.engagement.prospects[0];
  assert.ok(story.completed);
  assert.equal(story.moments.filter((m) => m.key === 'goal').length, 1);
  const mood = g.roster.find((p) => p.id === id).mood.value;
  recordEngagementMatch(g, { ...result, id: 'goal-4', date: gameDate(g), friendly: false });
  assert.equal(g.roster.find((p) => p.id === id).mood.value, mood);
});
test('Rivalry uses recorded losses and the real result updates fan support once', () => {
  const g = game(),
    opponent = 'kbo-kia';
  g.engagement.rivals = [
    { club: g.club, opponent, w: 0, l: 2, d: 0, recent: ['L', 'L'], lastDate: gameDate(g) },
  ];
  const stakes = matchStakes(g, world, opponent);
  assert.equal(stakes.kind, 'revenge');
  const result = {
    id: 'rival-win',
    day: g.day,
    date: gameDate(g),
    home: g.club,
    away: opponent,
    homeScore: 4,
    awayScore: 1,
    log: [],
    innings: [],
    hits: [],
    errors: [],
    mvp: '',
    story: { stakes, moments: [] },
  };
  recordEngagementMatch(g, result);
  assert.equal(g.engagement.support.value, 53);
  assert.equal(g.engagement.rivals[0].w, 1);
  recordEngagementMatch(g, result);
  assert.equal(g.engagement.support.value, 53);
  assert.equal(matchStakes(g, world, opponent), undefined);
});
test('Ten-game challenge creates a balanced fictional starting table and ten remaining fixtures per club', () => {
  const g = e.newGame('kbo-kia', 'Challenge', 'full', 42, { challenge: 'chase' });
  const rows = e.standings(g);
  assert.equal(g.mode, 'short');
  assert.equal(g.phase, 'regular');
  assert.equal(rows[5].club, g.club);
  assert.equal((rows[4].w - rows[5].w + rows[5].l - rows[4].l) / 2, 3);
  assert.equal(
    rows.reduce((n, r) => n + r.w, 0),
    rows.reduce((n, r) => n + r.l, 0),
  );
  assert.equal(
    rows.reduce((n, r) => n + r.rf, 0),
    rows.reduce((n, r) => n + r.ra, 0),
  );
  const fixtures = createCalendarView(world).fixtures(g, 'kbo');
  for (const row of rows)
    assert.equal(fixtures.filter((f) => [f.home, f.away].includes(row.club)).length, 10);
  assert.equal(g.history.length, 0);
  assert.equal(g.challenge.played, 0);
  assert.ok(g.news[0].body.includes('가상'));
});
test('Challenge success, second-season failure and leaving the club are evaluated from actual state once', () => {
  let g = e.newGame('kbo-kia', 'Challenge', 'short', 42, { challenge: 'chase' });
  g.phase = 'wildcard';
  g.postseason = {
    year: g.year,
    league: 'kbo',
    format: 'kbo',
    seeds: [g.club, 'a', 'b', 'c', 'd'],
    rounds: [],
  };
  tickChallenge(g, world);
  assert.equal(g.challenge.status, 'success');
  const count = g.news.length;
  tickChallenge(g, world);
  assert.equal(g.news.length, count);
  g = e.newGame('kbo-kia', 'Rebuild', 'short', 42, { challenge: 'rebuild' });
  assert.equal(g.club, 'kbo-kiwoom');
  g.phase = 'wildcard';
  g.postseason = {
    year: g.year,
    league: 'kbo',
    format: 'kbo',
    seeds: ['a', 'b', 'c', 'd', 'e'],
    rounds: [],
  };
  tickChallenge(g, world);
  assert.equal(g.challenge.status, 'active');
  g.year++;
  tickChallenge(g, world);
  assert.equal(g.challenge.status, 'failed');
  g = e.newGame('kbo-kia', 'Challenge', 'short', 42, { challenge: 'chase' });
  g = e.applyAction(g, { type: 'resignManager', confirm: true });
  assert.equal(g.challenge.status, 'failed');
});
test('Series delegation saves one game per command, uses both teams cards and stops at the series boundary', () => {
  let g = e.applyAction(game(), { type: 'readAllNews' });
  g = e.applyAction(g, { type: 'beginSeriesDelegation' });
  assert.equal(g.history.length, 0);
  assert.equal(g.engagement.seriesRun.fixtures.length, 2);
  let count = 0;
  while (g.engagement.seriesRun.status === 'running' && count++ < 10) {
    const before = g.history.length;
    g = e.applyAction(g, { type: 'delegateSeriesDay' });
    assert.ok(g.history.length - before <= 1);
  }
  assert.equal(g.engagement.seriesRun.status, 'completed');
  assert.equal(g.engagement.seriesRun.played, 2);
  assert.equal(g.history.length, 2);
  assert.ok(g.history.every((m) => m.delegatedBy && m.matchCards));
  assert.ok(g.media.journal.some((m) => m.stage === 'pre' && m.delegated));
  assert.ok(g.media.journal.some((m) => m.stage === 'post' && m.delegated));
});
test('An important report interrupts a saved delegation before another game and cannot be bypassed by reading a pending contract', () => {
  let g = e.applyAction(game(), { type: 'readAllNews' });
  g = e.applyAction(g, { type: 'beginSeriesDelegation' });
  const day = g.day;
  g.news.push({
    id: 'medical',
    day,
    title: 'Injury',
    body: '',
    kind: 'medical',
    actionView: 'medical',
  });
  assert.equal(seriesDelegationDecision(g).href, '/?view=inbox&report=medical');
  g = e.applyAction(g, { type: 'delegateSeriesDay' });
  assert.equal(g.engagement.seriesRun.status, 'interrupted');
  assert.equal(g.day, day);
  assert.equal(g.history.length, 0);
  g = game();
  g.managerCareer.offers.push({
    id: 'offer',
    club: g.club,
    source: 'renewal',
    status: 'offered',
    salary: 5,
    targetRank: 3,
    applied: gameDate(g),
    due: gameDate(g),
    expires: '2026-12-31',
    message: '',
  });
  assert.throws(() => e.applyAction(g, { type: 'beginSeriesDelegation' }), /계약/);
  assert.equal(seriesDelegationDecision(g).href, '/interviews/offer');
  g.managerCareer.offers[0].status = 'declined';
  assert.equal(seriesDelegationDecision(g), null);
  g.news = [
    {
      id: 'talk/1',
      playerId: g.roster[0].id,
      choiceKind: 'playingTime',
      read: true,
      kind: 'club',
      title: '',
      body: '',
      day,
    },
  ];
  assert.equal(seriesDelegationDecision(g).href, '/?view=inbox&report=talk%2F1');
  g.news[0].choice = 'explain';
  assert.equal(seriesDelegationDecision(g), null);
});
test('Highlight progression stops on an observed opportunity and cannot inspect later results to change its choice', () => {
  let g = game();
  g = e.applyAction(g, { type: 'startMatch' });
  const live = g.liveMatch,
    len = live.timeline.log.length;
  const from = 1,
    target = highlightCursor(live, g.club, from);
  assert.ok(target >= from + 1 && target <= len);
  const altered = structuredClone(live);
  for (let i = target; i < len; i++) altered.timeline.log[i].score = [99, 0];
  assert.equal(highlightCursor(altered, g.club, from), target);
  assert.equal(highlightCursor(live, g.club, len), len);
});

test('The ten-game challenge settles on the same command that finishes its actual regular schedule', () => {
  let g = e.newGame('kbo-kia', 'Finish challenge', 'short', 42, { challenge: 'chase' });
  g.weather.seed = 0;
  for (let i = 0; i < 80 && g.phase === 'regular'; i++) {
    g.news = [];
    g = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  }
  assert.notEqual(g.phase, 'regular');
  assert.equal(g.challenge.played, 10);
  assert.ok(['success', 'failed'].includes(g.challenge.status));
  assert.equal(g.history.filter((m) => !m.post && !m.friendly).length, 10);
  assert.equal(g.news.filter((n) => n.kind === 'challenge').length, 1);
});

test('A new delegated series requires routine mail to be read; an already running series keeps its approved scope', () => {
  let g = e.applyAction(game(), { type: 'readAllNews' });
  g.news.unshift({
    id: 'routine-before-series',
    day: g.day,
    title: '훈련 보고',
    body: '',
    kind: 'training',
  });
  assert.match(seriesDelegationDecision(g).reason, /안 읽은 수신함 1건/);
  assert.throws(() => e.applyAction(g, { type: 'beginSeriesDelegation' }), /안 읽은 수신함/);
  g = e.applyAction(g, { type: 'beginSeriesDelegation', readNewsIds: ['routine-before-series'] });
  g.news.unshift({
    id: 'routine-during-series',
    day: g.day,
    title: '훈련 보고',
    body: '',
    kind: 'training',
  });
  assert.equal(seriesDelegationDecision(g), null);
  const next = e.applyAction(g, { type: 'delegateSeriesDay' });
  assert.equal(next.engagement.seriesRun.played, 1);
  assert.equal(next.news.find((n) => n.id === 'routine-during-series').read, undefined);
});
