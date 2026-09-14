import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const built = await build({
  stdin: {
    contents: `export * from './tests/fixtures/engine';
      export * from './apps/api/src/domain/manager-background';
      export * from './apps/api/src/domain/manager-career';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  engine,
  world,
  fictionalManagerBackground,
  addFictionalPlayingCareer,
  createManagerCareer,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const ability = { tactics: 60, bullpen: 55, development: 75, motivation: 50, evaluation: 55 };

test('Every fictional origin gets a stable playing career before taking a coaching job', () => {
  const origins = new Set();
  for (let i = 0; i < 30; i++) {
    const id = `playing-qa-${i}`;
    const background = fictionalManagerBackground(id, '2026-03-01', '부산', ability);
    origins.add(background.entries[0].role);
    const playing = background.playingCareer;
    assert.equal(background.version, 2);
    assert.ok(playing.position && playing.summary && playing.retirement);
    assert.ok(playing.entries.every((entry) => entry.from <= entry.to && entry.to <= playing.to));
    const firstCoach = background.entries.find((entry) => !entry.role.startsWith('선수'));
    assert.ok(playing.to < firstCoach.from);
    assert.ok(playing.from <= playing.to && playing.to < '2026');
    assert.equal(
      playing.record,
      undefined,
      'fictional achievements must not look like KBO records',
    );
    assert.deepEqual(fictionalManagerBackground(id, '2026-03-01', '부산', ability), background);
  }
  assert.equal(origins.size, 3);
});

test('An old fictional biography gains playing details without rewriting its saved life', () => {
  for (const role of ['선수', '선수·학생 코치', '유소년 코치']) {
    const old = {
      version: 1,
      kind: 'fictional',
      summary: '예전 저장에 남긴 지도자 소개',
      entries: [
        { from: '2009', to: '2015', team: '부산 지역 야구 아카데미', role, detail: '저장된 이력' },
        { from: '2016', to: '2020', team: '부산 지역 육성팀', role: '육성 코치' },
        { from: '2021', to: '2023', team: '부산 독립 야구팀', role: '감독' },
      ],
    };
    const saved = structuredClone(old);
    addFictionalPlayingCareer('self:이전 감독', old);
    assert.equal(old.summary, saved.summary);
    assert.deepEqual(old.entries, saved.entries);
    assert.equal(old.playingCareer.to, role === '유소년 코치' ? '2008' : '2015');
    if (role.startsWith('선수')) assert.deepEqual(old.playingCareer.entries, [saved.entries[0]]);
    const reloaded = JSON.parse(JSON.stringify(old));
    addFictionalPlayingCareer('different-id-must-not-reroll', reloaded);
    assert.deepEqual(reloaded, old);
  }
});

test('Legacy self and real-manager saves receive new biographies while game history and RNG stay intact', () => {
  const g = engine.newGame('kbo-lotte', '선수 이력 QA', 'short', 516);
  const oldSelf = structuredClone(g.managerCareer.background);
  delete oldSelf.playingCareer;
  oldSelf.version = 1;
  g.managerCareer.background = structuredClone(oldSelf);
  const real = Object.values(g.managerPeople).filter(
    (p) => p.real && p.originClub.startsWith('kbo-'),
  );
  assert.equal(real.length, 10);
  for (const person of real) {
    person.background.version = 1;
    delete person.background.playingCareer;
  }
  const histories = real.map((p) => structuredClone(p.career));
  const ownHistory = structuredClone(g.managerCareer.history);
  const gameHistory = structuredClone(g.history);
  const seed = g.seed;
  createManagerCareer(world).prepare(g);
  assert.ok(g.managerCareer.background.playingCareer);
  assert.deepEqual(g.managerCareer.background.entries, oldSelf.entries);
  assert.deepEqual(g.managerCareer.history, ownHistory);
  assert.deepEqual(g.history, gameHistory);
  assert.equal(g.seed, seed);
  for (const [i, person] of real.entries()) {
    const catalog = world.clubs.find((c) => c.id === person.originClub).manager.background;
    assert.deepEqual(person.background, catalog);
    assert.notEqual(person.background, catalog, 'save must not mutate the shared catalog');
    assert.deepEqual(person.career, histories[i]);
  }
  const biographies = [g.managerCareer.background, ...real.map((p) => p.background)];
  const expected = structuredClone(biographies);
  g.managerCareer.reputation = 20;
  g.club = 'kbo-lg';
  g.year++;
  createManagerCareer(world).prepare(g);
  assert.deepEqual([g.managerCareer.background, ...real.map((p) => p.background)], expected);
});

test('KBO biographies include sourced playing clubs, retirement and records without losing overseas seasons', () => {
  const backgrounds = world.clubs
    .filter((c) => c.league === 'kbo')
    .map((c) => c.manager.background);
  assert.equal(backgrounds.length, 10);
  for (const background of backgrounds) {
    assert.equal(background.kind, 'verified');
    const playing = background.playingCareer;
    assert.ok(playing.position && playing.summary && playing.retirement && playing.record);
    assert.ok(playing.entries.length);
    assert.ok(playing.entries.every((entry) => entry.source.startsWith('https://')));
    assert.ok(playing.sources.every((source) => new URL(source.url).protocol === 'https:'));
    assert.equal(playing.entries[0].from, playing.from);
    assert.equal(playing.entries.at(-1).to, playing.to);
  }
  const career = (club) =>
    world.clubs.find((c) => c.id === `kbo-${club}`).manager.background.playingCareer;
  assert.ok(
    career('kia').entries.some(
      (entry) => entry.team === '소프트뱅크 호크스' && entry.from === '2010',
    ),
  );
  assert.match(career('samsung').entries.at(-1).team, /SK/);
  assert.equal(
    career('doosan').to,
    '2011',
    'last KBO appearance is not necessarily the retirement year',
  );
  assert.equal(career('kiwoom').to, '2001');
  assert.match(career('kiwoom').position, /투수/);
  assert.equal(career('nc').from, '1994', 'include the pitching debut before becoming a hitter');
  assert.ok(
    !career('nc').entries.some((entry) => entry.team.includes('LG')),
    'coaching clubs are not playing clubs',
  );
});
