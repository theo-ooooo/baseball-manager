import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-club-legacy-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/club-legacy';export * from './packages/shared/src/club-legacy';",
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
  recordClubSeason,
  clubLegacyAction,
  clubMemories,
  MAX_CLUB_MOMENTS,
} = createRequire(import.meta.url)(out);
function game() {
  return e.newGame('kbo-lotte', '기록 감독', 'short', 34, { preseason: false });
}
const result = (g, id = 'memory') => ({
  id,
  home: g.club,
  away: 'kbo-kia',
  homeScore: 3,
  awayScore: 2,
  mvp: '윤동희',
  day: 0,
  date: '2026-03-28',
});
test('Only real own-club official results can enter the scrapbook; no client score or foreign data is accepted', () => {
  const g = game(),
    r = result(g);
  g.history = [
    r,
    { ...r, id: 'friendly', friendly: true },
    { ...r, id: 'foreign', home: 'kbo-doosan' },
  ];
  assert.throws(() => clubLegacyAction(g, { type: 'pinClubMoment', id: 'fake' }), /공식 경기/);
  assert.throws(() => clubLegacyAction(g, { type: 'pinClubMoment', id: 'friendly' }), /공식 경기/);
  assert.throws(() => clubLegacyAction(g, { type: 'pinClubMoment', id: 'foreign' }), /공식 경기/);
  clubLegacyAction(g, {
    type: 'pinClubMoment',
    id: r.id,
    caption: '첫 끝내기',
    homeScore: 99,
    club: 'kbo-kia',
  });
  const m = g.clubLegacy.moments[0];
  assert.equal(m.homeScore, 3);
  assert.equal(m.club, g.club);
  assert.equal(m.caption, '첫 끝내기');
  assert.equal(m.mvp, r.mvp);
  clubLegacyAction(g, { type: 'pinClubMoment', id: r.id, caption: '기억할 승리' });
  assert.equal(g.clubLegacy.moments.length, 1);
  assert.equal(m.caption, '기억할 승리');
  g.history = [];
  g.year++;
  assert.equal(clubMemories(g, g.club).moments.length, 1);
  const owner = g.club;
  g.club = 'kbo-kia';
  clubLegacyAction(g, { type: 'removeClubMoment', id: r.id });
  assert.equal(clubMemories(g, owner).moments.length, 1);
});
test('Scrapbook stays bounded and removing a saved game opens one slot', () => {
  const g = game();
  g.history = Array.from({ length: MAX_CLUB_MOMENTS + 1 }, (_, i) => result(g, `m${i}`));
  for (const r of g.history.slice(0, MAX_CLUB_MOMENTS))
    clubLegacyAction(g, { type: 'pinClubMoment', id: r.id });
  assert.throws(
    () => clubLegacyAction(g, { type: 'pinClubMoment', id: g.history.at(-1).id }),
    /12경기/,
  );
  clubLegacyAction(g, { type: 'removeClubMoment', id: g.history[0].id });
  clubLegacyAction(g, { type: 'pinClubMoment', id: g.history.at(-1).id });
  assert.equal(g.clubLegacy.moments.length, 12);
  assert.throws(
    () =>
      clubLegacyAction(g, { type: 'pinClubMoment', id: g.history[1].id, caption: 'x'.repeat(81) }),
    /80자/,
  );
});
test('Season hall records real standings and heroes once, survives next season, and never fabricates old seasons', () => {
  const g = game(),
    row = g.standings.kbo.find((s) => s.club === g.club);
  row.w = 12;
  row.l = 6;
  row.d = 0;
  const bat = g.roster.find((p) => p.pos !== 'P');
  bat.stats = { ...bat.stats, ab: 70, h: 25, hr: 6, rbi: 21 };
  const pitch = g.roster.find((p) => p.pos === 'P');
  pitch.stats = { ...pitch.stats, outs: 81, k: 31, wins: 4, er: 6 };
  g.past = [{ year: 2024, rank: 1, w: 100, l: 44, champion: g.club }];
  recordClubSeason(g, world);
  assert.equal(g.clubLegacy, undefined);
  g.phase = 'finished';
  g.champion = g.club;
  recordClubSeason(g, world);
  recordClubSeason(g, world);
  const memory = structuredClone(g.clubLegacy);
  assert.equal(memory.seasons.length, 1);
  assert.equal(memory.seasons[0].year, g.year);
  assert.equal(memory.seasons[0].w, 12);
  assert.equal(memory.seasons[0].heroes[0].name, bat.name);
  g.managerCareer.contract.throughYear = g.year + 3;
  const next = e.applyAction(g, { type: 'nextSeason' });
  assert.equal(next.year, g.year + 1);
  assert.deepEqual(next.clubLegacy, memory);
  g.club = 'kbo-kia';
  recordClubSeason(g, world);
  assert.equal(clubMemories(g, 'kbo-lotte').seasons[0].champion, 'kbo-lotte');
});
