import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const out = join(tmpdir(), 'dugout-media-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './packages/shared/src/match-media'; export * from './apps/api/src/domain/game-engine'; export * from './apps/web/src/features/career/manager-flow';",
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
  createGameEngine,
  preMatchConversation,
  postMatchConversation,
  conversationKey,
  managerStep,
} = createRequire(import.meta.url)(out);
function ready() {
  const g = e.newGame('kbo-lotte', 'Media QA', 'short', 321);
  g.engagement.interviews = 'manual';
  g.engagement.reportMode = 'all';
  g.day = -22;
  return e.applyAction(g, { type: 'auto' });
}
const pre = (g) =>
  preMatchConversation(
    g,
    e.nextFixture(g),
    e.getClub(e.nextFixture(g).find((id) => id !== g.club)).name,
  );
const answer = (g, context, choice = 'support') =>
  e.applyAction(g, {
    type: 'matchConversation',
    stage: context.stage,
    key: context.key,
    answers: context.questions.map((q) => ({ id: q.id, choice })),
  });
function played(g) {
  g = e.applyAction(g, { type: 'startMatch' });
  return e.applyAction(g, {
    type: 'completeMatch',
    cursor: g.liveMatch.timeline.log.length,
    timelineVersion: g.liveMatch.timelineVersion,
  });
}

test('Pre-match press and team messages save once with bounded, actual player reactions and frozen answers', () => {
  const g = ready(),
    original = structuredClone(g),
    context = pre(g);
  const next = answer(g, context);
  assert.deepEqual(g, original);
  assert.equal(next.day, g.day);
  assert.equal(next.seed, g.seed);
  assert.equal(next.budget, g.budget);
  assert.equal(next.history.length, 0);
  assert.equal(next.media.preparedFor, context.key);
  assert.equal(next.media.journal.length, 1);
  assert.equal(next.media.journal[0].answers.length, 3);
  assert.ok(next.media.journal[0].reactions.some((r) => r.after > r.before));
  for (const r of next.media.journal[0].reactions) {
    assert.ok(Math.abs(r.after - r.before) <= 2);
    assert.equal(next.roster.find((p) => p.id === r.id).mood.value, r.after);
  }
  const withoutMood = (x) =>
    x.roster.map((p) => {
      const copy = { ...p };
      delete copy.mood;
      return copy;
    });
  assert.deepEqual(withoutMood(next), withoutMood(g));
  assert.throws(() => answer(next, context), /이미 마친/);
  const restored = JSON.parse(JSON.stringify(next));
  assert.throws(() => answer(restored, context), /이미 마친/);
  const active = e.applyAction(restored, { type: 'startMatch' });
  assert.deepEqual(
    active.liveMatch.prepared.input.roster.map((p) => p.mood),
    restored.roster.map((p) => p.mood),
  );
  assert.deepEqual(active.media.journal[0], restored.media.journal[0]);
});

test('Context uses past form, selected pitcher condition, actual score and errors instead of future outcomes', () => {
  const g = ready();
  g.roster.find((p) => p.id === g.starter).condition = 43;
  g.history = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    day: -23 - i,
    home: g.club,
    away: 'kbo-samsung',
    homeScore: 1,
    awayScore: 7,
    errors: [0, 2],
    log: [],
    innings: [],
    hits: [],
    mvp: '경기 수훈 선수',
  }));
  assert.match(pre(g).questions[0].text, /3패/);
  assert.match(pre(g).questions[1].text, /43%/);
  const context = postMatchConversation(g, g.history[0], '삼성 라이온즈');
  assert.match(context.questions[0].text, /1 대 7/);
  assert.match(context.questions[1].text, /실책 2개/);
  assert.equal(context.outcome, 'loss');
  const before = structuredClone(g);
  pre(g);
  postMatchConversation(g, g.history[0], '삼성');
  assert.deepEqual(g, before);
});

test('Post-match report precedes contextual interview; saved responses and reactions survive continuation', () => {
  let g = played(answer(ready(), pre(ready()))),
    context = g.media.pending;
  assert.ok(context);
  assert.equal(context.key, 'post:' + g.history[0].id);
  assert.equal(managerStep(g, false, 'inbox').kind, 'report');
  g = e.applyAction(g, { type: 'readAllNews' });
  assert.equal(managerStep(g, false, 'inbox').kind, 'media');
  const original = structuredClone(g),
    next = answer(g, context, 'calm');
  assert.equal(next.media.pending, undefined);
  assert.equal(next.media.journal.length, 2);
  assert.deepEqual(next.history, original.history);
  assert.equal(next.day, original.day);
  assert.throws(() => answer(next, context, 'challenge'), /진행할 인터뷰/);
  const record = JSON.parse(JSON.stringify(next.media.journal[0]));
  const continued = e.applyAction(JSON.parse(JSON.stringify(next)), {
    type: 'continueDay',
    simulateGames: true,
  });
  assert.deepEqual(
    continued.media.journal.find((r) => r.key === record.key),
    record,
  );
  assert.ok(next.news.find((n) => n.id === 'media:' + context.key).report.sections.length === 3);
});

test('Delegation records canonical responses, prevents forged partial answers and does not repeat morale bonuses', () => {
  const g = ready(),
    context = pre(g),
    original = structuredClone(g);
  for (const answers of [
    [],
    [null],
    context.questions.map((q) => ({ id: q.id, choice: 'invented' })),
    context.questions.map(() => ({ id: 'expectation', choice: 'support' })),
  ])
    assert.throws(() =>
      e.applyAction(g, { type: 'matchConversation', stage: 'pre', key: context.key, answers }),
    );
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'matchConversation',
        stage: 'pre',
        key: 'yesterday',
        delegated: true,
      }),
    /일정이 바뀌/,
  );
  const noCoach = structuredClone(g);
  noCoach.staff = [];
  assert.throws(
    () =>
      e.applyAction(noCoach, {
        type: 'matchConversation',
        stage: 'pre',
        key: context.key,
        delegated: true,
      }),
    /코치/,
  );
  const delegated = e.applyAction(g, {
    type: 'matchConversation',
    stage: 'pre',
    key: context.key,
    delegated: true,
    answers: [{ id: 'forged', choice: 'support' }],
  });
  assert.ok(delegated.media.journal[0].delegated);
  assert.ok(delegated.media.journal[0].answers.some((a) => a.choice !== 'calm'));
  assert.ok(delegated.media.journal[0].reactions.some((r) => r.after > r.before));
  assert.ok(delegated.media.journal[0].reactions.every((r) => Math.abs(r.after - r.before) <= 1));
  assert.deepEqual(g, original);
  const post = played(g),
    pending = post.media.pending;
  const continued = e.applyAction(post, { type: 'continueDay', simulateGames: true });
  const record = continued.media.journal.find((r) => r.key === pending.key);
  assert.ok(record.delegated);
  assert.ok(record.reactions.every((r) => r.after === r.before));
  assert.equal(continued.media.pending, undefined);
});

test('Doubleheaders have independent pre/post interview keys and bounded historical records', () => {
  const cloned = structuredClone(world);
  cloned.fixtures = [
    ...['a', 'b'].map((n) => ({
      id: 'media-double-' + n,
      league: 'kbo',
      date: '2026-03-28',
      home: 'kbo-lotte',
      away: 'kbo-samsung',
    })),
  ];
  const engine = createGameEngine(cloned);
  let g = engine.newGame('kbo-lotte', 'Double media', 'full', 51);
  g.phase = 'regular';
  g.day = 0;
  const key = conversationKey(g, [g.club, 'kbo-samsung']);
  const first = preMatchConversation(g, [g.club, 'kbo-samsung'], '삼성');
  g = engine.applyAction(g, {
    type: 'matchConversation',
    stage: 'pre',
    key: first.key,
    delegated: true,
  });
  g = engine.applyAction(g, { type: 'startMatch' });
  g = engine.applyAction(g, {
    type: 'completeMatch',
    cursor: g.liveMatch.timeline.log.length,
    timelineVersion: 1,
  });
  assert.equal(g.day, 0);
  assert.notEqual(conversationKey(g, [g.club, 'kbo-samsung']), key);
  g = engine.applyAction(g, {
    type: 'matchConversation',
    stage: 'post',
    key: g.media.pending.key,
    delegated: true,
  });
  const second = preMatchConversation(g, [g.club, 'kbo-samsung'], '삼성');
  g.media.journal = Array.from({ length: 20 }, (_, i) => ({
    ...g.media.journal[0],
    key: 'old-' + i,
  }));
  g = engine.applyAction(g, {
    type: 'matchConversation',
    stage: 'pre',
    key: second.key,
    delegated: true,
  });
  assert.equal(g.media.journal.length, 20);
  assert.equal(g.media.preparedFor, second.key);
});
