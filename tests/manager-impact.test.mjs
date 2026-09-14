import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents: `export * from './tests/fixtures/engine';
    export * from './apps/api/src/domain/match-simulation';
    export * from './apps/api/src/domain/match-timeline';
    export * from './apps/api/src/domain/manager-career';
    export * from './apps/api/src/domain/player-development';
    export * from './apps/api/src/domain/scouting';
    export * from './packages/shared/src/match-media';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  engine: e,
  world,
  createMatchSimulator,
  createPreparedMatchSimulator,
  generateTimeline,
  createManagerCareer,
  developPlayers,
  preMatchConversation,
  createScouting,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const abilities = (value) => ({
  tactics: value,
  bullpen: value,
  development: value,
  motivation: value,
  evaluation: value,
});
function ready() {
  const g = e.newGame('kbo-lotte', '지도자 QA', 'full', 4015);
  g.day = -22;
  return g;
}
const start = () => e.applyAction(ready(), { type: 'startMatch' });

test('Actual plate appearances use either manager under identical players and random rolls', () => {
  const base = start();
  for (const p of [...base.roster, ...base.liveMatch.opponents.flat()]) {
    for (const key of ['contact', 'power', 'speed', 'field', 'stuff', 'control']) p[key] = 65;
    p.condition = 100;
    p.mood = { ...(p.mood || {}), value: 65 };
  }
  base.staff.forEach((c) => (c.skill = 50));
  base.instructions = { power: 0, patience: 0, steal: 0, depth: 50, pitching: 'balanced' };
  base.tacticFamiliarity = 70;
  function first(away, home) {
    const g = structuredClone(base);
    g.liveMatch.managers = { version: 1, away, home };
    const iterator = createMatchSimulator(world)(g, g.liveMatch.home, g.liveMatch.away, () => 0.32);
    iterator.next();
    const step = iterator.next();
    iterator.return();
    return step.value.log[0];
  }
  const weakAttack = first({ ...abilities(55), tactics: 20 }, abilities(55));
  const strongAttack = first({ ...abilities(55), tactics: 95 }, abilities(55));
  assert.match(weakAttack.text, /삼진|범타/);
  assert.match(strongAttack.text, /안타|루타|홈런/);
  const weakPitching = first(abilities(55), { ...abilities(55), bullpen: 20 });
  const strongPitching = first(abilities(55), { ...abilities(55), bullpen: 95 });
  assert.match(weakPitching.text, /안타|루타|홈런/);
  assert.match(strongPitching.text, /삼진|범타/);
});

test('Frozen managers survive reload and the D1 fast command path without world or reputation data', () => {
  const g = start();
  assert.ok(g.liveMatch.managers.home && g.liveMatch.managers.away);
  const expected = structuredClone(g.liveMatch.timeline);
  const reloaded = JSON.parse(JSON.stringify(g));
  reloaded.managerCareer.reputation = 20;
  reloaded.managerPeople = {};
  reloaded.managerJobs = {};
  generateTimeline(reloaded, createPreparedMatchSimulator('kbo'));
  assert.deepEqual(reloaded.liveMatch.timeline, expected);
  assert.deepEqual(reloaded.liveMatch.managers, g.liveMatch.managers);
});

test('Old in-progress matches remain unchanged when manager reputation and jobs change', () => {
  const g = start();
  delete g.liveMatch.managers;
  generateTimeline(g, createMatchSimulator(world));
  const expected = structuredClone(g.liveMatch.timeline);
  g.managerCareer.reputation = 20;
  for (const p of Object.values(g.managerPeople)) p.ability = abilities(20);
  generateTimeline(g, createPreparedMatchSimulator('kbo'));
  assert.deepEqual(g.liveMatch.timeline, expected);
});

test('Delegating an active match retains both managers and already consumed plays', () => {
  let g = start();
  const live = structuredClone(g.liveMatch);
  const cursor = 10;
  g = e.applyAction(g, {
    type: 'delegateMatch',
    date: e.gameDate?.(g) || live.timeline.date,
    cursor,
    playbackId: live.playbackId,
    timelineVersion: live.timelineVersion,
  });
  const result = g.history.find((r) => r.id === live.timeline.id);
  assert.ok(result?.delegatedBy);
  assert.deepEqual(result.log.slice(0, cursor), live.timeline.log.slice(0, cursor));
});

test('Own manager development affects training and decline with the same staff, while potential remains a ceiling', () => {
  const base = ready();
  const young = base.roster.find((p) => p.pos !== 'P');
  young.age = 19;
  young.contact = 60;
  young.potential = 90;
  delete young.development;
  const veteran = base.roster.find((p) => p.pos === 'P');
  veteran.age = 44;
  veteran.stuff = 65;
  delete veteran.development;
  const low = structuredClone(base),
    high = structuredClone(base);
  low.managerCareer.journey.baseAbility = abilities(20);
  high.managerCareer.journey.baseAbility = abilities(95);
  for (let day = 0; day < 28; day++) {
    developPlayers(low);
    developPlayers(high);
    low.day++;
    high.day++;
  }
  const lp = low.roster.find((p) => p.id === young.id),
    hp = high.roster.find((p) => p.id === young.id);
  assert.ok(hp.contact > lp.contact && lp.contact > 60);
  assert.ok(hp.contact <= hp.potential && hp.contact - lp.contact < 1);
  assert.ok(
    high.roster.find((p) => p.id === veteran.id).stuff >
      low.roster.find((p) => p.id === veteran.id).stuff,
  );
});

test('Motivation changes actual mood responses; coach delegation follows the coach, with no repeat reward', () => {
  const base = ready();
  const context = preMatchConversation(base, e.nextFixture(base), '상대 구단');
  const action = {
    type: 'matchConversation',
    stage: 'pre',
    key: context.key,
    answers: context.questions.map((q) => ({
      id: q.id,
      choice: q.room === 'team' ? 'support' : 'calm',
    })),
  };
  const low = structuredClone(base),
    high = structuredClone(base);
  low.managerCareer.journey.baseAbility = abilities(20);
  high.managerCareer.journey.baseAbility = abilities(95);
  const a = e.applyAction(low, action),
    b = e.applyAction(high, action);
  const total = (g) => g.media.journal[0].reactions.reduce((s, r) => s + r.after - r.before, 0);
  assert.ok(total(b) > total(a));
  assert.ok(b.media.journal[0].reactions.every((r) => Math.abs(r.after - r.before) <= 2));
  assert.throws(() => e.applyAction(b, action), /이미 마친/);
  const c = e.applyAction(low, { ...action, delegated: true }),
    d = e.applyAction(high, { ...action, delegated: true });
  assert.equal(total(c), total(d));
});

test('Fictional background survives reputation changes, club moves and legacy normalization without consuming RNG', () => {
  const g = ready();
  const expected = structuredClone(g.managerCareer.background),
    seed = g.seed;
  assert.equal(expected.kind, 'fictional');
  assert.equal(expected.entries.length, 3);
  assert.ok(expected.entries.every((h) => Number(h.to.slice(0, 4)) < g.year));
  g.managerCareer.reputation = 20;
  g.year++;
  createManagerCareer(world).prepare(g);
  assert.deepEqual(g.managerCareer.background, expected);
  assert.equal(g.seed, seed);
  const copy = structuredClone(g);
  delete copy.managerCareer.background;
  copy.managerCareer.history.push({
    club: g.club,
    from: '2026-03-01',
    to: '2026-12-01',
    reason: 'resigned',
    rank: 3,
  });
  copy.club = 'kbo-lg';
  createManagerCareer(world).prepare(copy);
  assert.ok(copy.managerCareer.background.entries.every((h) => Number(h.to.slice(0, 4)) < 2026));
  assert.match(copy.managerCareer.background.summary, /부산/);
  const real = Object.values(g.managerPeople).filter(
    (p) => p.real && p.originClub.startsWith('kbo-'),
  );
  assert.equal(real.length, 10);
  assert.ok(
    real.every(
      (p) =>
        p.background.kind === 'verified' &&
        p.background.entries.every((h) => h.source.startsWith('https://')),
    ),
  );
});

test('Evaluation improves a completed scout report with the same scout and observation time', () => {
  const g = ready();
  const scout = g.staff.find((c) => c.role === '스카우트');
  const player = e.marketPlayers(g).find((p) => p.club === 'fa');
  const scouting = createScouting(world);
  scouting.action(g, { type: 'assignScout', playerId: player.id, scoutId: scout.id, days: 7 });
  g.day += 7;
  const low = structuredClone(g),
    high = structuredClone(g);
  low.managerCareer.journey.baseAbility = abilities(20);
  high.managerCareer.journey.baseAbility = abilities(95);
  scouting.tick(low);
  scouting.tick(high);
  assert.ok(high.scouting.reports[0].confidence > low.scouting.reports[0].confidence);
  assert.equal(high.budget, low.budget);
  assert.equal(high.seed, low.seed);
});
