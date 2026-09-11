import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const outfile = join(tmpdir(), 'dugout-match-card-draft.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/match-cards';export * from './apps/api/src/domain/match-cards';export * from './packages/shared/src/match-commands';export * from './apps/api/src/domain/match-command-actions';export * from './apps/api/src/domain/match-simulation';export * from './apps/api/src/domain/match-timeline';",
    resolveDir: process.cwd(),
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const m = createRequire(import.meta.url)(outfile),
  e = m.engine;
const start = (seed = 407) => {
  const g = e.newGame('kbo-lotte', '매 경기 카드 검증', 'short', seed);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch', matchCards: true });
};
const choose = (g, ids = g.liveMatch.cards.offered.slice(0, 3).map((c) => c.id), extra = {}) =>
  e.applyAction(g, {
    type: 'chooseMatchCards',
    draftId: g.liveMatch.cards.id,
    ids,
    cursor: 0,
    timelineVersion: g.liveMatch.timelineVersion,
    ...extra,
  });

test('Every match draws five distinct stable cards and fixes the opponent before selecting exactly three', () => {
  const g = start(),
    draft = g.liveMatch.cards,
    before = structuredClone(g);
  assert.equal(draft.offered.length, 5);
  assert.equal(new Set(draft.offered.map((c) => c.kind)).size, 5);
  assert.equal(draft.opponent.length, 3);
  assert.deepEqual(m.drawMatchCards(g), draft);
  assert.deepEqual(m.drawMatchCards(JSON.parse(JSON.stringify(g))), draft);
  assert.notDeepEqual(m.drawMatchCards({ ...g, day: g.day + 1 }), draft);
  assert.throws(() => choose(g, [draft.offered[0].id]), /3장/);
  assert.throws(
    () => choose(g, [draft.offered[0].id, draft.offered[0].id, draft.offered[2].id]),
    /3장/,
  );
  assert.throws(() => choose(g, ['forged', ...draft.offered.slice(0, 2).map((c) => c.id)]), /3장/);
  assert.throws(() => choose(g, undefined, { draftId: 'previous-match' }), /현재 경기/);
  assert.throws(
    () => e.applyAction(g, { type: 'completeMatch', cursor: g.liveMatch.timeline.log.length }),
    /카드 3장/,
  );
  assert.throws(
    () =>
      m.matchCommandAction(
        structuredClone(g),
        { cursor: 0, command: 'contactFocus' },
        m.createMatchSimulator(m.world),
      ),
    /카드 3장/,
  );
  const selected = choose(g);
  assert.equal(selected.liveMatch.cards.selected.length, 3);
  assert.deepEqual(selected.liveMatch.cards.opponent, draft.opponent);
  assert.equal(selected.liveMatch.timeline.matchCards.own.length, 3);
  assert.throws(() => choose(selected), /한 번/);
  assert.deepEqual(g, before);
});

test('Grades apply percentages to both teams and opposing cancellation removes augmentations without erasing cards', () => {
  const g = start(),
    draft = g.liveMatch.cards,
    p = g.roster.find((p) => p.pos !== 'P');
  draft.offered = [
    { id: 'pressure', kind: 'batterPressure', grade: 'silver' },
    { id: 'cancel', kind: 'nullify', grade: 'gold' },
    { id: 'boost', kind: 'power', grade: 'diamond' },
  ];
  draft.selected = ['pressure', 'cancel', 'boost'];
  draft.opponent = [{ id: 'other-cancel', kind: 'nullify', grade: 'gold' }];
  const original = structuredClone(p),
    away = m.matchCardPlayer(draft, p, false),
    own = m.matchCardPlayer(draft, p, true);
  assert.equal(away.contact, p.contact * 0.9);
  assert.equal(away.power, p.power * 0.9);
  assert.equal(own.power, p.power * 1.2);
  assert.equal(m.effectiveMatchAugmentation(draft, true), undefined);
  assert.equal(m.effectiveMatchAugmentation(draft, false), undefined);
  assert.deepEqual(p, original);
});

test('Card matches preserve replay prefixes, record real fatigue and never persist boosted player attributes', () => {
  const g = start(),
    selected = choose(g),
    original = structuredClone(selected.roster);
  const cursor = selected.liveMatch.timeline.log.findIndex(
    (_, i) =>
      i > 0 &&
      m
        .matchCommandOptions(selected.liveMatch, selected.club, i)
        .some((o) => o.kind === 'contactFocus' && !o.reason),
  );
  const next = e.applyAction(selected, {
    type: 'matchCommand',
    command: 'contactFocus',
    cursor,
    timelineVersion: selected.liveMatch.timelineVersion,
  });
  assert.deepEqual(
    next.liveMatch.timeline.log.slice(0, cursor),
    selected.liveMatch.timeline.log.slice(0, cursor),
  );
  assert.deepEqual(next.liveMatch.cards, selected.liveMatch.cards);
  const effects = next.liveMatch.prepared.effects;
  const applied = structuredClone(next);
  m.applyMatchEffects(applied);
  const completed = e.applyAction(next, {
    type: 'completeMatch',
    cursor: next.liveMatch.timeline.log.length,
    timelineVersion: next.liveMatch.timelineVersion,
  });
  assert.equal(completed.history[0].matchCards.own.length, 3);
  for (const p of applied.roster) {
    const previous = original.find((v) => v.id === p.id);
    for (const key of ['contact', 'power', 'stuff', 'control']) assert.equal(p[key], previous[key]);
  }
  assert.ok(
    effects.some(
      (p) =>
        original.find((v) => v.id === p.id)?.pos !== 'P' &&
        p.condition < original.find((v) => v.id === p.id).condition,
    ),
  );
  assert.equal(completed.liveMatch, undefined);
});
