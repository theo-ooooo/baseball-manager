import { reachFixture } from './helpers/manager.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-manager-flow-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/manager-flow.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const { engine: e, managerStep, matchReportId } = createRequire(import.meta.url)(out);

test('Continue handles required decisions and unread reports before the fixture without mutating the career', () => {
  let g = e.newGame('kbo-lotte', 'Flow', 'short', 12);
  const before = structuredClone(g);
  const step = managerStep(g, true, 'home');
  assert.equal(step.kind, 'report');
  assert.ok(g.news.some((n) => n.id === step.reportId && !n.read));
  assert.deepEqual(g, before);
  g.news.push({
    id: 'choice',
    day: g.day,
    title: '면담',
    body: '답변',
    kind: 'morale',
    read: true,
    choiceKind: 'playingTime',
  });
  assert.equal(managerStep(g, true, 'home').reportId, 'choice');
  assert.equal(managerStep(g, true, 'home').kind, 'decision');
  g.news.at(-1).choice = 'explain';
  g = e.applyAction(g, { type: 'readAllNews' });
  assert.equal(managerStep(g, true, 'home').kind, 'matchday');
  assert.equal(managerStep(g, true, 'matchday').label, '선수단 제출 · 경기장으로');
  assert.equal(managerStep(g, false, 'inbox').kind, 'continue');
  // A read contract-expiry reminder must not trap the manager until every player renews.
  assert.ok(g.roster.some((p) => p.years === 1));
  g.phase = 'finished';
  assert.equal(managerStep(g, false, 'inbox').kind, 'season');
});

test('Match preparation rejects unresolved decisions and completion identifies the exact stored match report', () => {
  let g = e.newGame('kbo-lotte', 'Matchday', 'short', 321);
  g = reachFixture(e, g);
  const pending = structuredClone(g);
  pending.news.push({
    id: 'choice',
    day: g.day,
    title: '면담',
    body: '답변',
    kind: 'morale',
    choiceKind: 'playingTime',
  });
  assert.throws(() => e.applyAction(pending, { type: 'startMatch' }), /필수 면담/);
  g = e.applyAction(g, { type: 'startMatch' });
  assert.equal(managerStep(g, true, 'matchday').kind, 'live');
  const before = structuredClone(g);
  const saved = e.applyAction(g, {
    type: 'completeMatch',
    cursor: g.liveMatch.timeline.log.length,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  const report = saved.news.find((n) => n.id === matchReportId(before, saved));
  assert.equal(report.matchId, saved.history[0].id);
  assert.equal(report.kind, 'match');
  assert.equal(saved.history.length, before.history.length + 1);
  assert.equal(matchReportId(saved, saved), undefined);
  assert.equal(
    JSON.parse(JSON.stringify(saved)).news.find((n) => n.id === report.id).matchId,
    saved.history[0].id,
  );
});
