import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-club-results.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/club-results';export * from './packages/shared/src/career-engagement';export * from './packages/shared/src/match-media';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine, clubResults, routineBriefing, preMatchConversation, hasMatchReplay } =
  createRequire(import.meta.url)(out);

test('After changing clubs, results and interview form include the new club before appointment without borrowing the previous club record', () => {
  const g = engine.newGame('kbo-samsung', '새 감독', 'short', 5, { preseason: false });
  g.day = 5;
  const result = (id, day, club, win) => ({
    id,
    fixtureId: id,
    day,
    date: `2026-03-${28 + day}`,
    home: 'kbo-ssg',
    away: club,
    homeScore: win ? 1 : 5,
    awayScore: win ? 5 : 1,
    innings: [[], []],
    hits: [0, 0],
    errors: [0, 0],
    log: [],
    mvp: '',
  });
  const old = result('previous', 3, 'kbo-kia', true);
  const own = [true, false, true, false].map((win, day) => result(`new-${day}`, day, g.club, win));
  g.history = [old, own[3]];
  g.worldResults = [own[3], ...own.slice(0, 3)];
  const before = structuredClone(g);
  assert.deepEqual(
    clubResults(g).map((r) => r.id),
    ['new-3', 'new-2', 'new-1', 'new-0'],
  );
  const briefing = routineBriefing(g, () => false);
  assert.equal(briefing.matches, 4);
  assert.equal(briefing.wins, 2);
  assert.match(preMatchConversation(g, [g.club, 'kbo-ssg'], 'SSG').summary, /최근 3경기 2패/);
  assert.deepEqual(
    g,
    before,
    'Reading club form must preserve archived matches for earlier employers',
  );
  g.club = 'kbo-kia';
  assert.deepEqual(
    clubResults(g).map((r) => r.id),
    ['previous'],
  );
});

test('Doubleheaders remain distinct and full history wins over a lightweight duplicate', () => {
  const g = engine.newGame('kbo-lotte', '기록', 'short', 9, { preseason: false });
  const first = {
    id: 'first',
    fixtureId: 'f1',
    day: 0,
    date: '2026-03-28',
    home: g.club,
    away: 'kbo-lg',
    log: [{ text: '상세 중계' }],
    innings: [[0], [0]],
  };
  const second = { ...first, id: 'second', fixtureId: 'f2', log: [] };
  g.history = [second, first];
  g.worldResults = [{ ...first, log: [] }, second];
  assert.deepEqual(
    clubResults(g).map((r) => r.id),
    ['second', 'first'],
  );
  assert.equal(clubResults(g)[1].log.length, 1);
  assert.equal(hasMatchReplay(first), true);
  assert.equal(
    hasMatchReplay({ ...first, log: [] }),
    true,
    'Archived innings can still be replayed',
  );
  assert.equal(
    hasMatchReplay({ ...first, log: [], innings: [] }),
    false,
    'World scores do not have an archive to fetch',
  );
  g.history = [{ ...first, date: '2027-01-02' }];
  g.worldResults = [];
  assert.equal(
    clubResults(g).length,
    1,
    'A winter season may continue into the next calendar year',
  );
});
