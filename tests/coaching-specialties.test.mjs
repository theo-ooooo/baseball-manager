import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export { gameDate } from './packages/shared/src/calendar'; export * from './apps/api/src/domain/coaching-specialties'; export * from './apps/api/src/domain/training-center'; export * from './apps/api/src/domain/medical'; export * from './packages/shared/src/training-center'; export * from './packages/shared/src/ratings'; export * from './packages/shared/src/player-profile-view';",
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
  specialistTraining,
  medicalAction,
  gameDate,
  ratingText,
  visibleOverall,
  prepareDailyTraining,
  trainingDay,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const add = (g, role, skill = 100) =>
  g.staff.push({ id: `test-${role}`, name: role, role, skill, salary: 10 });
test('Additional D1 seed candidates cover every specialist without duplicating initial staff or changing old posts', () => {
  for (const role of ['수석', '배터리', '주루·작전', '불펜', '재활'])
    assert.equal(world.coaches.filter((c) => !c.real && c.role === role).length, 4);
  for (const club of world.clubs) {
    const g = e.newGame(club.id, '보직 QA', 'short', 71);
    assert.equal(new Set(g.staff.map((c) => c.id)).size, g.staff.length);
    assert.equal(new Set(g.staff.map((c) => c.role)).size, g.staff.length);
    assert.ok(!g.staff.some((c) => c.role === '배터리'));
  }
});
test('Battery and bullpen coaching affect the relevant training only; vacant or expired posts add nothing', () => {
  const g = e.newGame('kbo-lotte', '훈련 QA', 'short', 72),
    catcher = g.roster.find((p) => p.pos === 'C'),
    infielder = g.roster.find((p) => p.pos === 'IF'),
    starter = g.roster.find((p) => p.id === g.pitching.rotation[0]),
    relief = g.roster.find((p) => p.pos === 'P' && !g.pitching.rotation.includes(p.id));
  assert.equal(specialistTraining(g, catcher, 'field'), 1);
  add(g, '배터리');
  add(g, '불펜');
  assert.equal(specialistTraining(g, catcher, 'field'), 1.15);
  assert.equal(specialistTraining(g, infielder, 'field'), 1);
  assert.equal(specialistTraining(g, starter, 'stuff'), 1);
  assert.equal(specialistTraining(g, relief, 'stuff'), 1.15);
  const days = Object.fromEntries(
    ['first', 'reserve'].map((s) => [s, trainingDay(g, s, gameDate(g), false, false)]),
  );
  const coached = prepareDailyTraining(g, days);
  g.staff = g.staff.filter((c) => !['배터리', '불펜'].includes(c.role));
  const baseline = prepareDailyTraining(g, days);
  assert.ok(coached.get(catcher.id).factors.field > baseline.get(catcher.id).factors.field);
  assert.equal(coached.get(infielder.id).factors.field, baseline.get(infielder.id).factors.field);
  add(g, '배터리');
  g.staff.at(-1).contractUntil = g.year;
  assert.equal(specialistTraining(g, catcher, 'field'), 1);
});
test('Rehabilitation coaching reduces recurrence once and preserves the promised return date', () => {
  const g = e.newGame('kbo-lotte', '재활 QA', 'short', 73),
    p = g.roster[0];
  add(g, '재활');
  p.injury = {
    id: 'qa',
    name: '근육 부상',
    occurred: gameDate(g),
    returnDate: '2026-04-20',
    earliestReturn: gameDate(g),
    severity: 'moderate',
    phase: 'treatment',
    recurrenceRisk: 40,
  };
  medicalAction(g, { type: 'rehabPlayer', id: p.id });
  assert.equal(p.injury.recurrenceRisk, 25);
  assert.equal(p.injury.returnDate, '2026-04-20');
  medicalAction(g, { type: 'earlyReturnPlayer', id: p.id, confirm: true });
  medicalAction(g, { type: 'rehabPlayer', id: p.id });
  assert.equal(p.injury.recurrenceRisk, 25);
});
test('Missing real-player evidence still shows the actual game overall as an estimate while scout fog stays intact', () => {
  for (const p of world.players.filter((p) => p.real && p.rating.status === 'estimated')) {
    assert.match(ratingText(p), /^\d+\*$/);
    assert.equal(visibleOverall(p), e.overall(p));
  }
  const p = structuredClone(world.players[0]);
  p.observation = { status: 'unknown' };
  assert.equal(ratingText(p), '?');
  assert.equal(visibleOverall(p), undefined);
});
