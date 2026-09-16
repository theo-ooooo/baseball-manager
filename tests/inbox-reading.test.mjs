import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/web/src/features/inbox/inbox-order';export * from './apps/web/src/features/inbox/inbox-read-memory';export * from './apps/web/src/features/career/manager-flow';export * from './packages/shared/src/calendar';",
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
  orderedInbox,
  inboxReadingOrder,
  firstUnreadReport,
  nextUnreadAfter,
  createInboxReadMemory,
  managerStep,
  gameDate,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const game = () => e.newGame('kbo-lotte', '메일 검증', 'full', 121, { preseason: false });
test('Inbox order follows dates, preserves same-day order and next unread never wraps to the top', () => {
  const g = game();
  const news = [
    { id: 'today-new', date: '2026-03-30', read: false },
    { id: 'old', date: '2026-03-28', read: false },
    { id: 'today-old', date: '2026-03-30', read: false },
  ];
  const newest = orderedInbox(g, news, 'newest');
  assert.deepEqual(
    newest.map((n) => n.id),
    ['today-new', 'today-old', 'old'],
  );
  assert.deepEqual(
    orderedInbox(g, news, 'oldest').map((n) => n.id),
    ['old', 'today-old', 'today-new'],
  );
  assert.equal(nextUnreadAfter(newest, 'today-old').id, 'old');
  assert.equal(nextUnreadAfter(newest, 'old'), undefined);
  assert.deepEqual(
    orderedInbox(
      g,
      news.map((n) => ({ ...n, read: true })),
      'newest',
    ).map((n) => n.id),
    newest.map((n) => n.id),
  );
});
test('Local reading remains pending until the server acknowledges the exact IDs', () => {
  const memory = createInboxReadMemory();
  const g = game();
  g.news = [
    { id: 'one', read: false },
    { id: 'two', read: false },
  ];
  memory.mark(['one', 'two']);
  const snapshot = memory.snapshot();
  memory.mark(['one']);
  assert.equal(memory.snapshot(), snapshot);
  memory.reconcile(g);
  assert.equal(memory.snapshot().size, 2);
  g.news[0].read = true;
  memory.reconcile(g);
  assert.deepEqual([...memory.snapshot()], ['two']);
  memory.clear();
  assert.equal(memory.snapshot().size, 0);
});
test('Date progress consumes selected read intents without answering decisions or altering the input save', () => {
  const g = game();
  const id = g.news[0].id,
    before = structuredClone(g);
  const next = e.applyAction(g, { type: 'continueDay', simulateGames: true, readNewsIds: [id] });
  assert.equal(next.news.find((n) => n.id === id).read, true);
  assert.deepEqual(g, before);
  const ignored = e.applyAction(g, { type: 'auto', readNewsIds: [id] });
  assert.equal(ignored.news.find((n) => n.id === id).read, false);
  assert.throws(() => e.applyAction(g, { type: 'continueDay', readNewsIds: [3] }), /읽은 보고/);
});
test('Vacation continues past ordinary reports and returns with accumulated unread mail', () => {
  let g = e.applyAction(game(), { type: 'startVacation', days: 4 });
  const start = g.day,
    end = g.managerCareer.vacationUntil;
  const first = g.news[0].id;
  for (let i = 1; i <= 4; i++) {
    const step = managerStep(g, true, 'inbox');
    assert.equal(step.kind, 'continue');
    assert.equal(step.reportId, undefined);
    g = e.applyAction(g, { type: 'continueDay', simulateGames: true });
    assert.equal(g.day, start + i);
    if (i < 4) {
      assert.ok(g.managerCareer.vacationUntil);
      assert.equal(g.progress.stop, null);
      assert.deepEqual(g.progress.newsIds, []);
    }
  }
  assert.equal(gameDate(g), end);
  assert.equal(g.managerCareer.vacationUntil, undefined);
  assert.equal(g.progress.stop, 'report');
  assert.ok(g.progress.newsIds.includes(first));
  const summary = g.news.find((n) => n.vacationSummary);
  assert.deepEqual(summary.vacationSummary, {
    club: g.club,
    from: gameDate({ ...g, day: start }),
    through: end,
  });
  assert.equal(g.managerCareer.vacationStarted, undefined);
  assert.ok(g.news.filter((n) => !n.read).length > 1);
});

test('All-report mode selects the oldest unread including same-day arrival order', () => {
  const g = game();
  g.engagement.reportMode = 'all';
  g.news = [
    { id: 'new', title: '새 보고', kind: 'club', date: '2026-03-30', read: false },
    { id: 'old-read', title: '읽음', kind: 'club', date: '2026-03-27', read: true },
    { id: 'old-new', title: '둘째', kind: 'club', date: '2026-03-28', read: false },
    { id: 'old-first', title: '첫째', kind: 'club', date: '2026-03-28', read: false },
  ];
  assert.equal(firstUnreadReport(g).id, 'old-first');
  assert.equal(managerStep(g, false, 'inbox').reportId, 'old-first');
  g.news[3].read = true;
  assert.equal(firstUnreadReport(g).id, 'old-new');
  assert.equal(nextUnreadAfter(orderedInbox(g, g.news), 'old-first').id, 'old-new');
  g.managerCareer.status = 'unemployed';
  assert.equal(managerStep(g, false, 'inbox').reportId, 'old-new');
});

test('List stays newest first while reading uses original oldest arrival order under either list sort', () => {
  const g = game();
  g.news = [
    { id: 'new', date: '2026-03-30' },
    { id: 'later', date: '2026-03-28' },
    { id: 'first', date: '2026-03-28' },
  ];
  const displayed = orderedInbox(g, g.news, 'newest');
  assert.equal(displayed[0].id, 'new');
  for (const order of ['newest', 'oldest'])
    assert.deepEqual(
      inboxReadingOrder(g, g.news, orderedInbox(g, g.news, order)).map((n) => n.id),
      ['first', 'later', 'new'],
    );
});
