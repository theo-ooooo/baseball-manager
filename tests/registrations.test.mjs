import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-registration-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './packages/shared/src/registrations'; export * from './packages/shared/src/roster-rules'; export * from './apps/api/src/domain/registration-log'; export * from './apps/api/src/domain/ai-registrations'; export * from './apps/api/src/domain/world-simulation'; export * from './packages/shared/src/calendar';",
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
  recallStatus,
  recallWaitingDays,
  gameDate,
  addDays,
  recordSquadMove,
  createAiRegistrations,
  saveWorldPlayer,
  createWorldSimulation,
} = createRequire(import.meta.url)(output);
function setup() {
  return e.newGame('kbo-lotte', '등록 검증', 'full', 83, { preseason: false });
}
test('KBO registration waits ten calendar days across saves, including exchange registration; no-op is not logged', () => {
  let g = setup();
  const p = g.roster.find((p) => p.pos === 'P' && p.squad !== 'reserve' && p.id !== g.starter);
  const unchanged = e.applyAction(g, { type: 'squad', id: p.id, value: 'first' });
  assert.equal(unchanged.registrations?.events.length || 0, 0);
  g = e.applyAction(g, { type: 'squad', id: p.id, value: 'reserve' });
  const today = gameDate(g);
  assert.equal(g.registrations.events[0].date, today);
  assert.equal(recallStatus(g, p).eligible, addDays(today, 10));
  assert.equal(recallStatus(g, p).remaining, 10);
  const original = JSON.stringify(g);
  assert.throws(() => e.applyAction(g, { type: 'squad', id: p.id, value: 'first' }), /재등록/);
  assert.equal(JSON.stringify(g), original);
  g = JSON.parse(JSON.stringify(g));
  g.day += 9;
  assert.throws(() => e.applyAction(g, { type: 'squad', id: p.id, value: 'first' }), /1일 남음/);
  const other = g.roster.find((x) => x.pos === 'P' && x.squad !== 'reserve' && x.id !== g.starter);
  assert.throws(
    () => e.applyAction(g, { type: 'squad', id: other.id, value: 'reserve', replaceId: p.id }),
    /재등록/,
  );
  g.day++;
  g = e.applyAction(g, { type: 'squad', id: p.id, value: 'first' });
  assert.equal(g.roster.find((x) => x.id === p.id).squad, 'first');
  assert.equal(recallStatus(g, p), null);
  assert.equal(g.registrations.events.length, 2);
});
test('Preseason moves do not create cooldowns; rule durations distinguish MLB pitchers and use actual dates over year boundaries', () => {
  let g = e.newGame('kbo-lotte', '봄 캠프', 'short', 8);
  const p = g.roster.find((p) => p.pos === 'P' && p.squad !== 'reserve' && p.id !== g.starter);
  g = e.applyAction(g, { type: 'squad', id: p.id, value: 'reserve' });
  assert.equal(recallStatus(g, p), null);
  assert.equal(g.registrations.events[0].eligible, undefined);
  assert.equal(recallWaitingDays({ club: 'npb-giants', pos: 'P' }), 10);
  assert.equal(recallWaitingDays({ club: 'mlb-dodgers', pos: 'P' }), 15);
  assert.equal(recallWaitingDays({ club: 'mlb-dodgers', pos: 'OF' }), 10);
  g = setup();
  g.calendar.openingDate = '2026-12-25';
  const hitter = g.roster.find((p) => p.squad !== 'reserve' && p.pos !== 'P');
  recordSquadMove(g, hitter, 'reserve', '날짜 검증');
  assert.equal(recallStatus(g, hitter).eligible, '2027-01-04');
});
test('AI demotions use repeated poor performance and persist in the actual match roster, while ordinary fatigue alone causes no moves', () => {
  const g = setup(),
    ai = createAiRegistrations(world),
    club = 'kbo-hanwha';
  g.day = (3 - (e.hash(club) % 3)) % 3;
  ai.prepare(g, club, false);
  const players = e.rosterFor(g, club),
    p = players.find((p) => p.pos === 'P' && p.squad !== 'reserve');
  p.condition = 35;
  saveWorldPlayer(g, p);
  ai.prepare(g, club);
  assert.equal(g.registrations.events.length, 0);
  assert.equal(p.squad, 'first');
  g.day += 3;
  p.condition = 100;
  p.stats.g = 4;
  p.stats.outs = 60;
  p.stats.er = 20;
  saveWorldPlayer(g, p);
  ai.prepare(g, club);
  assert.equal(p.squad, 'reserve');
  assert.match(g.registrations.events.find((ev) => ev.playerId === p.id).reason, /성적 부진.*ERA/);
  assert.equal(g.registrations.events.length, 2);
  const next = JSON.parse(JSON.stringify(g)),
    restored = e.rosterFor(next, club).find((x) => x.id === p.id);
  assert.equal(restored.squad, 'reserve');
  assert.equal(recallStatus(next, restored).remaining, 10);
  const prior = structuredClone(restored.stats);
  createWorldSimulation(world).recordGame(next, {
    id: 'registration-box',
    home: club,
    away: 'kbo-lg',
    homeScore: 4,
    awayScore: 2,
    day: next.day,
  });
  assert.deepEqual(e.rosterFor(next, club).find((x) => x.id === p.id).stats, prior);
  ai.prepare(g, club);
  assert.equal(g.registrations.events.length, 2);
});
test('The registry keeps bounded actual events, never fabricates older announcements, and keeps first/reserve destinations paired', () => {
  const g = e.newGame('kbo-lotte', '이력 검증', 'short', 17),
    p = g.roster[0];
  assert.equal(g.registrations, undefined);
  for (let i = 0; i < 605; i++)
    recordSquadMove(g, p, p.squad === 'reserve' ? 'first' : 'reserve', '등록 조정');
  assert.equal(g.registrations.events.length, 600);
  assert.equal(new Set(g.registrations.events.map((e) => e.id)).size, 600);
  assert.ok(g.registrations.events.every((e) => e.from !== e.to && e.date === gameDate(g)));
  g.day += 31;
  recordSquadMove(g, p, p.squad === 'reserve' ? 'first' : 'reserve', '새 날짜');
  assert.equal(g.registrations.events.length, 1);
});
test('Initializing a new club workspace preserves its registered roster and cannot bypass an existing recall wait', () => {
  let g = setup();
  const p = g.roster.find((p) => p.pos === 'P' && p.squad !== 'reserve' && p.id !== g.starter);
  g = e.applyAction(g, { type: 'squad', id: p.id, value: 'reserve' });
  const expected = g.registrations.clubs[g.club].first.slice().sort();
  delete g.reserve;
  g = e.applyAction(g, { type: 'readNews', id: g.news[0].id });
  assert.deepEqual(
    g.roster
      .filter((p) => p.squad !== 'reserve')
      .map((p) => p.id)
      .sort(),
    expected,
  );
  assert.equal(g.roster.find((x) => x.id === p.id).squad, 'reserve');
  assert.equal(recallStatus(g, p).remaining, 10);
  assert.equal(g.registrations.events.length, 1);
  assert.equal(g.lineup.length, 9);
});
