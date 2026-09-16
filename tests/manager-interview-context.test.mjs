import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';export * from './packages/shared/src/manager-interview';export * from './apps/api/src/domain/manager-career';",
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
  gameDate,
  managerInterviewQuestions,
  createManagerCareer,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
function interview(rank, endKind = 'nonrenewal') {
  const g = e.newGame('kbo-lotte', '복귀 감독', 'short', 191, {
    unemployed: true,
    preseason: false,
  });
  g.managerCareer.reputation = 80;
  g.managerCareer.history = [
    {
      club: 'kbo-kia',
      from: '2025-03-01',
      to: '2025-12-31',
      reason: 'resigned',
      endKind,
      rank,
      targetRank: 3,
    },
  ];
  g.managerJobs['kbo-samsung'].vacant = true;
  g.managerCareer.offers = [
    {
      id: 'qa-interview',
      club: 'kbo-samsung',
      targetRank: 3,
      salary: 100,
      applied: gameDate(g),
      due: gameDate(g),
      expires: '2026-12-31',
      status: 'interview',
      priority: 'win',
      rivalScore: 99,
      message: '',
    },
  ];
  return g;
}
function answerAll(g, careerAnswer) {
  for (const [question, answer] of [
    ['motivation', 'project'],
    ['career', careerAnswer],
    ['style', 'win'],
    ['target', 'agree'],
    ['budget', 'within'],
    ['staff', 'keep'],
  ])
    g = e.applyAction(g, { type: 'managerInterview', id: 'qa-interview', question, answer });
  g.day += 2;
  createManagerCareer(world).tick(g);
  return g;
}
test('Proven and dismissed managers get different concrete questions, and contextual answers change the actual hiring decision', () => {
  const proven = interview(1),
    failed = interview(8, 'dismissal');
  const questions = (g) => managerInterviewQuestions(g, g.managerCareer.offers[0], '삼성');
  assert.match(questions(proven)[1].question, /성과.*재현/);
  assert.match(questions(failed)[0].question, /경질/);
  assert.match(questions(failed)[1].question, /8위.*3위/);
  const getOffer = (g) => g.managerCareer.offers.find((o) => o.id === 'qa-interview');
  assert.equal(getOffer(answerAll(proven, 'confidence')).status, 'offered');
  assert.equal(getOffer(answerAll(proven, 'responsibility')).status, 'rejected');
  assert.equal(getOffer(answerAll(failed, 'responsibility')).status, 'offered');
  assert.equal(getOffer(answerAll(failed, 'confidence')).status, 'rejected');
});
test('Interview profile is frozen once answers start, and budget promises remain real contract terms', () => {
  let g = interview(1);
  g = e.applyAction(g, {
    type: 'managerInterview',
    id: 'qa-interview',
    question: 'motivation',
    answer: 'project',
  });
  g.managerCareer.history[0].rank = 9;
  const offer = g.managerCareer.offers[0];
  assert.match(managerInterviewQuestions(g, offer, '삼성')[1].question, /성적 1위/);
  for (const [question, answer] of [
    ['career', 'confidence'],
    ['style', 'win'],
    ['target', 'ambitious'],
    ['budget', 'extra'],
  ])
    g = e.applyAction(g, { type: 'managerInterview', id: offer.id, question, answer });
  assert.equal(g.managerCareer.offers[0].targetRank, 2);
  assert.equal(g.managerCareer.offers[0].budgetAdjustment, 0.1);
  assert.equal(g.managerCareer.offers[0].interview.at(-1).score, 1);
});
