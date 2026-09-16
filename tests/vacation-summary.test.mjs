import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/calendar';export * from './apps/web/src/features/inbox/vacation-summary-model';",
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
  gameDate,
  vacationSummaryModel,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
test('Vacation summary keeps pending decisions above routine reports and clears them after an answer without marking mail read', () => {
  let g = e.newGame('kbo-lotte', '휴가 감독', 'short', 911, { preseason: false });
  const from = gameDate(g);
  g = e.applyAction(g, { type: 'startVacation', days: 7 });
  g.day += 3;
  g = e.applyAction(g, { type: 'endVacation' });
  const summary = g.news.find((n) => n.vacationSummary);
  assert.deepEqual(summary.vacationSummary, { club: g.club, from, through: gameDate(g) });
  const decision = {
    id: 'pending',
    title: '선수 면담',
    body: '',
    day: 0,
    date: from,
    kind: 'morale',
    choiceKind: 'playingTime',
    read: true,
  };
  g.news.push(
    decision,
    { id: 'normal', title: '경기 보고', body: '', day: 0, date: from, kind: 'match', read: false },
    {
      id: 'medical',
      title: '부상 보고',
      body: '',
      day: 0,
      date: from,
      kind: 'club',
      actionView: 'medical',
      read: false,
    },
  );
  g.history = [
    {
      id: 'a',
      date: from,
      home: g.club,
      away: 'kbo-lg',
      homeScore: 4,
      awayScore: 2,
      log: [],
      innings: [],
    },
    {
      id: 'b',
      date: gameDate(g),
      home: 'kbo-lg',
      away: g.club,
      homeScore: 3,
      awayScore: 1,
      log: [],
      innings: [],
    },
  ];
  const before = structuredClone(g);
  const view = vacationSummaryModel(g, summary);
  assert.ok(view.decisions.some((n) => n.id === 'pending'));
  assert.ok(view.attention.some((n) => n.id === 'medical'));
  assert.ok(view.routine.some((n) => n.id === 'normal'));
  assert.equal(view.wins, 1);
  assert.equal(view.losses, 1);
  assert.deepEqual(g, before);
  decision.choice = 'discuss';
  assert.ok(!vacationSummaryModel(g, summary).decisions.some((n) => n.id === 'pending'));
  g.club = 'kbo-samsung';
  assert.equal(vacationSummaryModel(g, summary).decisions.length, 0);
});
