import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-individual-training-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/development.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  developPlayers,
  prepareDevelopment,
  gameDate,
} = createRequire(import.meta.url)(out);
function setup() {
  const g = e.newGame('kbo-lotte', 'Training', 'full', 76);
  const p = g.roster.find((p) => !p.real && p.pos !== 'P');
  p.age = 19;
  p.condition = 90;
  p.potential = 90;
  for (const key of ['contact', 'power', 'field', 'speed']) p[key] = 50;
  prepareDevelopment(g);
  return { g, p };
}
const plan = (p, extra = {}) => ({
  type: 'setTrainingPlan',
  id: p.id,
  focus: 'contact',
  intensity: 'normal',
  restDays: [],
  ...extra,
});
function train(g, days = 7) {
  for (let i = 0; i < days; i++) {
    developPlayers(g);
    g.day++;
  }
  return g;
}

test('Individual focus changes observed growth, rests reduce workload, and clearing restores team training', () => {
  const { g, p } = setup();
  const before = structuredClone(g);
  const focused = e.applyAction(g, plan(p));
  assert.deepEqual(g, before);
  assert.equal(focused.roster.find((x) => x.id === p.id).contact, 50);
  assert.equal(focused.seed, g.seed);
  assert.equal(focused.budget, g.budget);
  const resting = e.applyAction(g, plan(p, { restDays: [0, 1, 2, 3, 4, 5, 6] }));
  const cleared = e.applyAction(focused, { type: 'clearTrainingPlan', id: p.id });
  assert.deepEqual(cleared, g);
  train(g);
  train(focused);
  train(resting);
  train(cleared);
  const base = g.roster.find((x) => x.id === p.id);
  const strong = focused.roster.find((x) => x.id === p.id);
  assert.ok(strong.contact > base.contact);
  assert.ok(strong.power < base.power);
  assert.ok(resting.roster.find((x) => x.id === p.id).contact < base.contact);
  assert.deepEqual(cleared, g);
});

test('Mentoring needs an eligible teammate with stronger abilities and good morale; saved training resumes deterministically', () => {
  const { g, p } = setup();
  const mentor = g.roster.find((m) => m.pos !== 'P' && m.id !== p.id && m.age >= 26);
  mentor.contact = 90;
  mentor.mood.value = 80;
  const alone = e.applyAction(g, plan(p));
  const mentored = e.applyAction(g, plan(p, { mentorId: mentor.id }));
  const unhappy = structuredClone(mentored);
  unhappy.roster.find((x) => x.id === mentor.id).mood.value = 30;
  const gone = structuredClone(mentored);
  gone.roster = gone.roster.filter((x) => x.id !== mentor.id);
  train(alone);
  train(mentored, 3);
  const restored = JSON.parse(JSON.stringify(mentored));
  train(mentored, 4);
  train(restored, 4);
  train(unhappy);
  train(gone);
  assert.deepEqual(JSON.parse(JSON.stringify(mentored)), restored);
  assert.ok(
    mentored.roster.find((x) => x.id === p.id).contact >
      alone.roster.find((x) => x.id === p.id).contact,
  );
  assert.equal(
    unhappy.roster.find((x) => x.id === p.id).contact,
    alone.roster.find((x) => x.id === p.id).contact,
  );
  assert.equal(
    gone.roster.find((x) => x.id === p.id).contact,
    alone.roster.find((x) => x.id === p.id).contact,
  );
});

test('Daily training uses the elapsed weekday for recovery and stops at a once-only goal report', () => {
  const { g, p } = setup();
  p.condition = 40;
  const base = e.applyAction(g, { type: 'continueDay', simulateGames: true });
  const day = new Date(gameDate(g) + 'T12:00:00Z').getUTCDay();
  const rested = e.applyAction(e.applyAction(g, plan(p, { restDays: [day] })), {
    type: 'continueDay',
    simulateGames: true,
  });
  const intense = e.applyAction(e.applyAction(g, plan(p, { intensity: 'intense' })), {
    type: 'continueDay',
    simulateGames: true,
  });
  assert.equal(
    rested.roster.find((x) => x.id === p.id).condition,
    base.roster.find((x) => x.id === p.id).condition + 4,
  );
  assert.equal(
    intense.roster.find((x) => x.id === p.id).condition,
    base.roster.find((x) => x.id === p.id).condition - 3,
  );
  let goal = e.applyAction(g, plan(p, { target: 50.001 }));
  goal = e.applyAction(goal, { type: 'continueDay', simulateGames: true });
  const achieved = goal.roster.find((x) => x.id === p.id).trainingPlan;
  assert.ok(achieved.achieved);
  const report = goal.news.find((n) => n.title.includes('개인 육성 목표 달성'));
  assert.equal(report.playerId, p.id);
  assert.ok(goal.progress.newsIds.includes(report.id));
  assert.equal(goal.progress.stop, 'report');
  const oldReport = structuredClone(report);
  goal = e.applyAction(JSON.parse(JSON.stringify(goal)), {
    type: 'continueDay',
    simulateGames: true,
  });
  assert.equal(goal.news.filter((n) => n.title.includes('개인 육성 목표 달성')).length, 1);
  assert.deepEqual(
    goal.news.find((n) => n.id === report.id),
    oldReport,
  );
});

test('Training rejects foreign players, invalid targets, hidden ratings, invalid mentors and excess mentoring load', () => {
  let { g, p } = setup();
  for (const invalid of [
    { id: 'foreign' },
    { focus: 'stuff' },
    { intensity: 'invalid' },
    { restDays: [7] },
    { restDays: [1, 1] },
    { restDays: [1.5] },
    { target: 50 },
    { target: 100 },
    { target: Infinity },
    { focus: 'balanced', target: 60 },
    { mentorId: p.id },
    { mentorId: g.roster.find((x) => x.pos === 'P').id },
  ])
    assert.throws(() => e.applyAction(g, plan(p, invalid)));
  const hidden = g.roster.find((x) => x.real && x.pos !== 'P');
  hidden.rating = { ...hidden.rating, status: 'missing' };
  assert.throws(() => e.applyAction(g, plan(hidden, { target: 99 })), /평가/);
  const mentor = g.roster.find((m) => m.pos !== 'P' && m.id !== p.id && m.age >= 26);
  const pupils = g.roster.filter((x) => x.id !== mentor.id && x.pos !== 'P').slice(0, 4);
  for (const pupil of pupils) pupil.age = 19;
  for (const pupil of pupils.slice(0, 3))
    g = e.applyAction(g, plan(pupil, { mentorId: mentor.id }));
  assert.throws(() => e.applyAction(g, plan(pupils[3], { mentorId: mentor.id })), /세 명/);
  assert.doesNotThrow(() => e.applyAction(g, plan(pupils[0], { mentorId: mentor.id })));
});
