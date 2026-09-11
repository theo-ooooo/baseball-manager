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
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/match-cards';export * from './apps/api/src/domain/match-cards';export * from './packages/shared/src/match-commands';export * from './apps/api/src/domain/match-command-actions';export * from './apps/api/src/domain/match-simulation';export * from './apps/api/src/domain/match-timeline';export * from './apps/api/src/domain/match-card-runtime';export * from './packages/shared/src/match-card-decisions';export * from './packages/shared/src/match-decision';export * from './apps/web/src/features/matches/coach-match-card';",
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
    active = { own: m.selectedMatchCards(draft), opponent: draft.opponent },
    away = m.matchCardPlayer(draft, p, false, active),
    own = m.matchCardPlayer(draft, p, true, active);
  assert.equal(away.contact, p.contact * 0.9);
  assert.equal(away.power, p.power * 0.9);
  assert.equal(own.power, p.power * 1.2);
  assert.equal(m.effectiveMatchAugmentation(draft, true, active), undefined);
  assert.equal(m.effectiveMatchAugmentation(draft, false, active), undefined);
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

test('One-use cards are reserved until a legal moment, persist as spent and preserve watched plays', () => {
  const g = start();
  const selected = choose(g);
  const live = selected.liveMatch;
  const hand = m.selectedMatchCards(live.cards);
  const opportunity = live.timeline.log
    .flatMap((_, cursor) => hand.map((card) => ({ cursor, card })))
    .find(({ cursor, card }) => !m.matchCardUseReason(live, selected.club, cursor, card.id));
  assert.ok(opportunity);
  const { cursor, card } = opportunity;
  const request = {
    type: 'useMatchCard',
    draftId: live.cards.id,
    cardId: card.id,
    cursor,
    timelineVersion: live.timelineVersion,
  };
  const next = e.applyAction(selected, request);
  assert.deepEqual(
    next.liveMatch.timeline.log.slice(0, cursor),
    live.timeline.log.slice(0, cursor),
  );
  assert.deepEqual(next.liveMatch.cards.used, [{ cardId: card.id, cursor }]);
  assert.equal(next.liveMatch.timeline.log[cursor].play.cards.own, card.id);
  assert.equal(
    next.liveMatch.timeline.log.filter((event) => event.play?.cards?.own === card.id).length,
    1,
  );
  assert.throws(
    () => e.applyAction(next, { ...request, timelineVersion: next.liveMatch.timelineVersion }),
    /이미 사용/,
  );
  assert.throws(() => e.applyAction(selected, { ...request, cursor: 0 }), /기회·실점 위기/);
  const another = hand.find((entry) => entry.id !== card.id);
  assert.throws(
    () =>
      e.applyAction(next, {
        ...request,
        cardId: another.id,
        timelineVersion: next.liveMatch.timelineVersion,
      }),
    /한 타석/,
  );
  const reloaded = JSON.parse(JSON.stringify(next));
  const sign = m
    .matchCommandOptions(reloaded.liveMatch, reloaded.club, cursor)
    .find((option) => !option.reason && !option.kind.startsWith('steal'));
  const revised = e.applyAction(reloaded, {
    type: 'matchCommand',
    command: sign.kind,
    cursor,
    timelineVersion: reloaded.liveMatch.timelineVersion,
  });
  assert.deepEqual(revised.liveMatch.cards.used, next.liveMatch.cards.used);
  assert.equal(
    revised.liveMatch.timeline.log.filter((event) => event.play?.cards?.own === card.id).length,
    1,
  );
});

test('Automatic augmentation fires once at scoring position; cancellation consumes it and cards never carry to another plate appearance', () => {
  const g = start(),
    draft = g.liveMatch.cards;
  draft.offered = [
    { id: 'boost', kind: 'power', grade: 'diamond' },
    { id: 'cancel', kind: 'nullify', grade: 'gold' },
    { id: 'control', kind: 'control', grade: 'silver' },
  ];
  draft.selected = draft.offered.map((card) => card.id);
  draft.opponent = [
    { id: 'other-cancel', kind: 'nullify', grade: 'gold' },
    { id: 'other-boost', kind: 'power', grade: 'silver' },
    { id: 'other-contact', kind: 'contact', grade: 'bronze' },
  ];
  draft.used = [
    { cardId: 'boost', cursor: 2 },
    { cardId: 'cancel', cursor: 4 },
  ];
  const runtime = m.createMatchCardRuntime(draft);
  assert.equal(runtime(0, true, false, false, false).augmentation, undefined);
  assert.equal(runtime(1, true, true, true, false), undefined);
  const first = runtime(2, true, true, false, false);
  assert.equal(first.augmentations.own, draft.augmentation);
  assert.equal(first.augmentations.blocked, true);
  assert.equal(first.augmentation, undefined);
  assert.equal(first.cards.own, 'boost');
  assert.equal(first.cards.opponent, 'other-cancel');
  const after = runtime(3, true, true, false, false);
  assert.equal(after.augmentations, undefined);
  assert.deepEqual(after.active.own, []);
  assert.equal(after.cards, undefined);
  const threat = runtime(4, false, true, false, false);
  assert.equal(threat.augmentations.opponent, draft.opponentAugmentation);
  assert.equal(threat.augmentations.blocked, true);
  assert.equal(threat.cards.own, 'cancel');
  assert.equal(runtime(5, false, true, false, false).augmentations, undefined);
  assert.equal(runtime(6, false, true, false, false).cards, undefined);
  const untouched = m.matchCardPlayer(draft, g.roster[0], true);
  assert.equal(untouched, g.roster[0]);
  assert.equal(m.effectiveMatchAugmentation(draft, true), undefined);
  const other = m.createMatchCardRuntime({ ...draft, opponent: [], used: [] });
  assert.equal(other(1, true, true, false, false).augmentation, draft.augmentation);
  assert.equal(other(2, true, true, false, false).augmentation, undefined);
});

test('Coach recommends only a usable held card, prioritizes cancellation and never inspects future outcomes', () => {
  const initial = start();
  initial.liveMatch.cards.offered = [
    { id: 'contact', kind: 'contact', grade: 'silver' },
    { id: 'power', kind: 'power', grade: 'silver' },
    { id: 'nullify', kind: 'nullify', grade: 'gold' },
    { id: 'control', kind: 'control', grade: 'gold' },
    { id: 'pressure', kind: 'batterPressure', grade: 'gold' },
  ];
  const g = choose(initial, ['contact', 'power', 'nullify']);
  const live = g.liveMatch;
  const threat = live.timeline.log.findIndex(
    (_, cursor) => !m.matchCardUseReason(live, g.club, cursor, 'nullify'),
  );
  assert.ok(threat > 0);
  assert.equal(m.coachMatchCard(g, threat).card.kind, 'nullify');
  assert.equal(m.coachMatchCard(g, 0), undefined);
  const spent = structuredClone(g);
  spent.liveMatch.cards.used = [{ cardId: 'nullify', cursor: threat }];
  assert.equal(m.coachMatchCard(spent, threat), undefined);
  const opportunity = live.timeline.log.findIndex(
    (_, cursor) => !m.matchCardUseReason(live, g.club, cursor, 'contact'),
  );
  assert.ok(opportunity > 0);
  const attack = structuredClone(g);
  attack.liveMatch.timeline.log[opportunity - 1].score = [0, 0];
  attack.liveMatch.timeline.log[opportunity - 1].play.after.outs = 2;
  const advice = m.coachMatchCard(attack, opportunity);
  assert.equal(advice.card.kind, 'contact');
  assert.match(advice.reason, /2사/);
  const altered = structuredClone(attack);
  altered.liveMatch.timeline.log = altered.liveMatch.timeline.log.map((event, index) =>
    index < opportunity ? event : { inning: 12, half: 1, text: '홈런', score: [99, 99] },
  );
  assert.deepEqual(m.coachMatchCard(altered, opportunity), advice);
});
