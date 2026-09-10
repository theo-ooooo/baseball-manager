import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-training-center-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/development'; export * from './packages/shared/src/training-center'; export * from './apps/api/src/domain/training-center';",
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
  gameDate,
  prepareDevelopment,
  developPlayers,
  trainingDay,
  playerTrainingDay,
  trainingCoach,
  trainingCenterFor,
  prepareDailyTraining,
  recordDailyTraining,
  trainingMonday,
} = createRequire(import.meta.url)(output);
function setup() {
  const g = e.newGame('kbo-lotte', '훈련 검증', 'full', 76);
  const p = g.roster.find((p) => !p.real && p.pos !== 'P');
  p.age = 19;
  p.condition = 80;
  p.potential = 90;
  for (const key of ['contact', 'power', 'field', 'speed']) p[key] = 50;
  prepareDevelopment(g);
  return { g, p };
}
function schedule(g, slots = ['general', 'general', 'rest'], squad = 'first') {
  return e.applyAction(g, {
    type: 'setTrainingSchedule',
    squad,
    template: 'balanced',
    days: { [gameDate(g)]: slots },
  });
}
function daily(g) {
  return prepareDailyTraining(g, {
    first: trainingDay(g, 'first', gameDate(g), false, false),
    reserve: trainingDay(g, 'reserve', gameDate(g), false, false),
  });
}
test('Schedule saves independently for each squad, without instant growth or extra spending; validates dates, slots and coaches', () => {
  const { g, p } = setup(),
    original = structuredClone(g);
  const next = schedule(g, ['batting', 'power', 'rest']);
  assert.deepEqual(g, original);
  assert.deepEqual(next.roster, g.roster);
  assert.equal(next.seed, g.seed);
  assert.equal(next.budget, g.budget);
  assert.deepEqual(next.trainingCenter.programs.first.days[gameDate(g)], [
    'batting',
    'power',
    'rest',
  ]);
  assert.deepEqual(next.trainingCenter.programs.reserve.days, {});
  const twice = schedule(next, ['rest', 'rest', 'rest'], 'reserve');
  assert.deepEqual(twice.trainingCenter.programs.first, next.trainingCenter.programs.first);
  for (const extra of [
    { days: { '2026-02-01': ['rest', 'rest', 'rest'] } },
    { days: { '2026-02-30': ['rest', 'rest', 'rest'] } },
    { days: { [gameDate(g)]: ['unknown', 'rest', 'rest'] } },
    { template: 'constructor' },
    { squad: 'foreign' },
  ]) {
    assert.throws(
      () =>
        e.applyAction(g, {
          type: 'setTrainingSchedule',
          squad: 'first',
          template: 'balanced',
          days: {},
          ...extra,
        }),
      /훈련|선수단/,
    );
  }
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'setTrainingStaff',
        responsibility: 'manager',
        coaches: { batting: 'outside-coach' },
      }),
    /소속/,
  );
  assert.throws(
    () => e.applyAction(g, { type: 'setTrainingRest', restBelow: 70, lightBelow: 60 }),
    /기준/,
  );
  const active = structuredClone(g);
  active.day = -22;
  const live = e.applyAction(active, { type: 'startMatch' });
  assert.throws(() => schedule(live), /경기/);
  assert.throws(() => e.applyAction(live, { type: 'setTrainingPlan', id: p.id }), /경기/);
});
test('Actual fixtures reserve the match slot; delegation ignores but preserves manual plans; legacy read is non-mutating', () => {
  const { g } = setup();
  const changed = schedule(g, ['physical', 'physical', 'physical']);
  assert.deepEqual(trainingDay(changed, 'first', gameDate(g), true, false).slots, [
    'physical',
    'match',
    'physical',
  ]);
  const staff = e.applyAction(changed, {
    type: 'setTrainingStaff',
    responsibility: 'staff',
    coaches: {},
  });
  assert.deepEqual(trainingDay(staff, 'first', gameDate(g), true, false).slots, [
    'tactics',
    'match',
    'recovery',
  ]);
  assert.deepEqual(
    staff.trainingCenter.programs.first.days,
    changed.trainingCenter.programs.first.days,
  );
  const restored = e.applyAction(staff, {
    type: 'setTrainingStaff',
    responsibility: 'manager',
    coaches: {},
  });
  assert.deepEqual(trainingDay(restored, 'first', gameDate(g), false, false).slots, [
    'physical',
    'physical',
    'physical',
  ]);
  delete g.trainingCenter;
  g.training = 'rest';
  const before = structuredClone(g);
  assert.equal(trainingCenterFor(g).programs.first.template, 'recovery');
  assert.deepEqual(g, before);
  assert.equal(trainingMonday('2026-03-01'), '2026-02-23');
  assert.equal(trainingMonday('2026-03-02'), '2026-03-02');
});
test('Growth, condition and risk follow the same workload, with auto rest taking precedence over intense personal plans', () => {
  const { g, p } = setup();
  const group = p.squad === 'reserve' ? 'reserve' : 'first';
  const strong = schedule(g, ['physical', 'physical', 'physical'], group),
    rest = schedule(g, ['rest', 'rest', 'rest'], group);
  const heavy = daily(strong).get(p.id),
    resting = daily(rest).get(p.id);
  assert.ok(heavy.load > 3);
  assert.ok(heavy.risk > resting.risk);
  assert.ok(heavy.recovery < resting.recovery);
  developPlayers(strong, daily(strong));
  developPlayers(rest, daily(rest));
  assert.ok(strong.roster.find((x) => x.id === p.id).speed > 50);
  assert.equal(rest.roster.find((x) => x.id === p.id).speed, 50);
  const snapshot = structuredClone(strong.roster);
  developPlayers(strong, daily(strong));
  assert.deepEqual(strong.roster, snapshot);
  const tired = structuredClone(g);
  const player = tired.roster.find((x) => x.id === p.id);
  player.condition = 40;
  player.trainingPlan = {
    focus: 'speed',
    intensity: 'intense',
    restDays: [],
    started: gameDate(tired),
  };
  const low = playerTrainingDay(
    tired,
    player,
    trainingDay(strong, group, gameDate(g), false, false),
  );
  assert.equal(low.load, 0);
  assert.match(low.reason, /自|자동 휴식/);
  assert.ok(Object.values(low.factors).every((x) => x === 0));
  const normal = e.applyAction(schedule(g, ['general', 'general', 'rest'], group), {
    type: 'continueDay',
    simulateGames: true,
  });
  const rested = e.applyAction(schedule(g, ['rest', 'rest', 'rest'], group), {
    type: 'continueDay',
    simulateGames: true,
  });
  assert.ok(
    rested.roster.find((x) => x.id === p.id).condition >
      normal.roster.find((x) => x.id === p.id).condition,
  );
  assert.equal(normal.trainingCenter.lastDay, gameDate(g));
  assert.equal(normal.trainingCenter.tally.days, 1);
});
test('Specialist coaching and shared duties change effective training; calendar saves do not leak hidden ability values', () => {
  const { g } = setup();
  g.staff = [
    { id: 'hit', name: '타격 코치', role: '타격', skill: 80, salary: 50, style: 'balanced' },
    { id: 'pitch', name: '투수 코치', role: '투수', skill: 80, salary: 50, style: 'balanced' },
  ];
  const expert = trainingCoach(g, 'batting');
  const overloaded = e.applyAction(g, {
    type: 'setTrainingStaff',
    responsibility: 'manager',
    coaches: { batting: 'hit', pitching: 'hit', defense: 'hit', fitness: 'hit' },
  });
  assert.ok(trainingCoach(overloaded, 'batting').efficiency < expert.efficiency);
  assert.equal(trainingCoach(overloaded, 'pitching').specialist, false);
  assert.equal(trainingCoach(overloaded, 'batting').count, 4);
  const trained = schedule(g);
  assert.deepEqual(trained.roster, g.roster);
});
test('Seven elapsed training days produce one bounded report; saved state resumes deterministically', () => {
  const { g } = setup();
  for (let i = 0; i < 3; i++) {
    recordDailyTraining(g, daily(g));
    g.day++;
  }
  const restored = JSON.parse(JSON.stringify(g));
  for (const state of [g, restored])
    for (let i = 0; i < 4; i++) {
      recordDailyTraining(state, daily(state));
      const before = JSON.stringify(state.trainingCenter);
      recordDailyTraining(state, daily(state));
      assert.equal(JSON.stringify(state.trainingCenter), before);
      state.day++;
    }
  assert.deepEqual(JSON.parse(JSON.stringify(g)), JSON.parse(JSON.stringify(restored)));
  assert.equal(g.news.filter((n) => n.title === '주간 훈련 보고').length, 1);
  assert.equal(g.trainingCenter.report.days, 7);
  assert.equal(g.trainingCenter.tally, undefined);
});
