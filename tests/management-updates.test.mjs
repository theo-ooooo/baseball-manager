import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-management-updates.cjs');
buildSync({
  stdin: {
    contents: `export * from './tests/fixtures/engine';export * from './packages/shared/src/trade-policy';export * from './packages/shared/src/trade-window';export * from './packages/shared/src/match-box-score';export * from './packages/shared/src/tactic-cards';export * from './packages/shared/src/augmentations';export * from './apps/api/src/domain/augmentations';export * from './apps/api/src/domain/tactic-cards';export * from './apps/api/src/domain/board-transactions';export * from './apps/api/src/domain/manager-valuation';export * from './apps/api/src/domain/manager-career';export * from './apps/api/src/domain/board-objectives';export * from './apps/api/src/domain/trades';export * from './apps/api/src/domain/rookie-draft';export * from './packages/shared/src/draft-rules';export * from './apps/api/src/domain/squad-management';export * from './packages/shared/src/pitching';export * from './apps/api/src/domain/club-dynamics';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const m = createRequire(import.meta.url)(out),
  e = m.engine;
const game = () => e.newGame('kbo-lotte', '관리 개선 테스트', 'short', 849);
const player = (id, ability = 60, extra = {}) => ({
  ...game().roster[0],
  id,
  name: id,
  club: 'kbo-lg',
  age: 28,
  contact: ability,
  power: ability,
  speed: ability,
  field: ability,
  stuff: ability,
  control: ability,
  potential: ability + 5,
  pos: 'P',
  rating: undefined,
  personality: { loyalty: 30, ambition: 50, money: 50, stubbornness: 50, homeClub: 'kbo-lg' },
  ...extra,
});
const roster = () => Array.from({ length: 30 }, (_, i) => player(`depth${i}`, 45));
test('Franchise players and major prospects cannot be bought with unlimited cash', () => {
  const star = player('franchise', 84, { personality: { loyalty: 95, homeClub: 'kbo-lg' } }),
    r = [star, ...roster()];
  assert.equal(m.playerClubStanding(star, r).tier, 'franchise');
  assert.equal(m.assessTradeReturn(r, [player('weak', 30)], [star], 1e7).status, 'rejected');
  const core = player('core', 84),
    r2 = [core, ...roster()];
  assert.match(m.assessTradeReturn(r2, [player('weak', 30)], [core], 1e7).reason, /현금으로 대신/);
  const prospect = player('prospect', 65, { age: 21, potential: 92 });
  assert.equal(
    m.assessTradeReturn(
      [player('ace', 95), player('ace2', 94), player('ace3', 93), prospect, ...roster()],
      [player('weak', 30)],
      [prospect],
      1e7,
    ).status,
    'rejected',
  );
});
test('A meaningful return is accepted but cash cannot cover missing player value', () => {
  const p = player('ordinary', 55),
    r = [...roster().map((v) => ({ ...v, stuff: 75, control: 75 })), p];
  assert.equal(m.assessTradeReturn(r, [player('return', 70)], [p], 0).status, 'accepted');
  assert.equal(m.assessTradeReturn(r, [player('weak', 20)], [p], 1e7).status, 'rejected');
});
test('Completed star acquisitions and franchise departures affect board trust once and persist through reviews', () => {
  const g = game(),
    star = player('star', 90, { personality: { loyalty: 95, homeClub: 'kbo-lg' } }),
    other = [star, ...roster()];
  m.recordBoardTransaction(g, 'trade-1', [star], [], other);
  const job = g.managerJobs[g.club],
    credit = job.transfers.credit;
  assert.equal(credit, 10);
  m.recordBoardTransaction(g, 'trade-1', [star], [], other);
  assert.equal(job.transfers.credit, 10);
  const ours = player('ours', 95, { club: g.club, personality: { loyalty: 95, homeClub: g.club } });
  g.roster.push(ours);
  m.recordBoardTransaction(g, 'trade-2', [], [ours], other);
  assert.equal(job.transfers.credit, -2);
  m.updateBoardTrust(job, {
    year: g.year,
    rank: 1,
    target: 5,
    count: 10,
    wins: 0,
    losses: 0,
    draws: 0,
    financePenalty: 0,
  });
  assert.equal(job.confidence, job.baseConfidence - 2);
});
test('Season success proposes renewal without changing salary or forcing a contract extension', () => {
  const g = game();
  g.phase = 'finished';
  const career = m.createManagerCareer(m.world),
    c = g.managerCareer.contract;
  c.targetRank = 10;
  delete c.objective;
  const prior = { salary: c.salary, throughYear: c.throughYear };
  career.review(g);
  assert.equal(c.salary, prior.salary);
  assert.equal(c.throughYear, prior.throughYear);
  const offer = g.managerCareer.offers.find((o) => o.source === 'renewal');
  assert.ok(offer);
  assert.equal(offer.salary, Math.round(prior.salary * 1.15 * 100) / 100);
  career.review(g);
  assert.equal(g.managerCareer.offers.filter((o) => o.source === 'renewal').length, 1);
  let next = e.applyAction(g, {
    type: 'acceptManagerTerms',
    id: offer.id,
    termsVersion: offer.contractTerms.version,
  });
  const agreed = next.managerCareer.offers.find((o) => o.id === offer.id);
  const beforeAppointed = next.managerJobs[next.club].appointed;
  next = e.applyAction(next, {
    type: 'signManager',
    id: offer.id,
    termsVersion: agreed.contractTerms.version,
    signature: next.manager,
  });
  assert.equal(next.managerCareer.contract.salary, offer.salary);
  assert.equal(next.managerJobs[next.club].appointed, beforeAppointed);
  assert.equal(next.managerCareer.history.length, 0);
});
test('Board requests remain available midseason and repeated requests cannot farm grants', () => {
  const g = game();
  g.day = 10;
  g.phase = 'regular';
  const a = { type: 'boardNegotiate', objective: 'youth', benefit: 'funds', targetRank: 1 };
  m.boardAction(g, a, m.world);
  const after = g.budget;
  assert.doesNotThrow(() => m.boardAction(g, a, m.world));
  assert.equal(g.budget, after);
  assert.match(g.news[0].body, /지원|예산|성과/);
});
test('Coach pitching placement excludes unavailable players and preserves unique assignments', () => {
  const g = game(),
    p = g.roster.find((p) => p.pos === 'P' && p.squad !== 'reserve');
  p.internationalDuty = { name: '대표팀', returnDate: '2026-12-01' };
  m.managementAction(g, { type: 'recommendPitching' });
  const plan = g.pitching,
    ids = [...plan.rotation, plan.closer, ...plan.bullpen].filter(Boolean);
  assert.ok(!ids.includes(p.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(g.defense.P, g.starter);
  assert.ok(plan.rotation.length <= 5);
});
test('Played match participants are not penalized for sitting out in a delegated result', () => {
  const g = game(),
    p = g.roster.find((p) => p.squad !== 'reserve');
  g.day = 20;
  p.mood = { ...p.mood, value: 70, role: 'core', lastPlayedDay: 0, reason: '' };
  p.stats.g = 0;
  m.matchMorale(g, {
    id: 'mood-test',
    home: g.club,
    away: 'kbo-lg',
    homeScore: 5,
    awayScore: 2,
    replayTeams: [
      { lineup: [], players: [], defense: {} },
      { lineup: [p.id], players: [], defense: {} },
    ],
    log: [],
    delegatedBy: '수석 코치',
  });
  assert.ok(p.mood.value > 70);
  assert.doesNotMatch(p.mood.reason, /출전 부족|기용 부족/);
});
test('Box score counts individual hits and pitching outs including a steal without adding an at-bat', () => {
  const state = (outs, score = [0, 0]) => ({ outs, bases: [null, null, null], score });
  const r = {
    home: 'home',
    away: 'away',
    homeScore: 0,
    awayScore: 1,
    hits: [2, 0],
    errors: [0, 0],
    replayTeams: [
      { lineup: ['a'], players: [{ id: 'a', name: '타자' }] },
      { players: [{ id: 'p', name: '투수' }] },
    ],
    log: [
      {
        half: 0,
        text: '안타',
        play: { batter: 'a', pitcher: 'p', before: state(0), after: state(0) },
      },
      {
        half: 0,
        text: '홈런',
        play: { batter: 'a', pitcher: 'p', before: state(0), after: state(0, [1, 0]) },
      },
      {
        half: 0,
        text: '도루 실패',
        play: {
          batter: 'a',
          pitcher: 'p',
          plateAppearance: false,
          before: state(0, [1, 0]),
          after: state(1, [1, 0]),
        },
      },
    ],
  };
  const box = m.matchBoxScore(r);
  assert.equal(box[0].batters[0].h, 2);
  assert.equal(box[0].batters[0].ab, 2);
  assert.equal(box[0].batters[0].hr, 1);
  assert.equal(box[1].pitchers[0].outs, 1);
  assert.equal(box[1].pitchers[0].r, 1);
});
test('Initial hand has five stable cards, grades change strength, and use/return cannot duplicate cards', () => {
  let g = game();
  g.phase = 'regular';
  g.day = 0;
  assert.equal(g.tacticCards.hand.length, 5);
  assert.deepEqual(m.initialCards(1), m.initialCards(1));
  assert.ok(m.cardGrades.diamond.strength > m.cardGrades.gold.strength);
  g = e.applyAction(g, { type: 'drawInitialCards' });
  assert.equal(g.tacticCards.hand.length, 5);
  const c = g.tacticCards.hand[0],
    p = e.rosterFor(g, 'kbo-lg').find((p) => m.cardTargetEligible(c, p));
  g = e.applyAction(g, { type: 'armTacticCard', id: c.id, target: p.id });
  assert.equal(g.tacticCards.hand.length, 4);
  const before = p[m.cardCatalog[c.kind].attribute],
    modified = m.cardEffectPlayer(g, p);
  assert.equal(
    modified[m.cardCatalog[c.kind].attribute],
    Math.max(1, before - m.cardGrades[c.grade].strength),
  );
  assert.equal(p[m.cardCatalog[c.kind].attribute], before);
  g = e.applyAction(g, { type: 'returnTacticCard' });
  g = e.applyAction(g, { type: 'returnTacticCard' });
  assert.equal(g.tacticCards.hand.length, 5);
});
test('Augmentation rewards are earned, bounded and consumed by official matches only', () => {
  let g = game();
  g = e.applyAction(g, { type: 'enableAugmentations' });
  g = e.applyAction(g, { type: 'enableAugmentations' });
  assert.equal(g.augmentations.credits, 1);
  g = e.applyAction(g, { type: 'chooseAugmentation', kind: 'power' });
  assert.equal(g.augmentations.active.remaining, 5);
  assert.throws(() => e.applyAction(g, { type: 'chooseAugmentation', kind: 'zone' }));
  m.afterAugmentedMatch(g, { id: 'friendly', friendly: true });
  assert.equal(g.augmentations.active.remaining, 5);
  for (let i = 0; i < 8; i++) m.afterAugmentedMatch(g, { id: `m${i}` });
  assert.equal(g.augmentations.active, undefined);
  assert.equal(g.augmentations.credits, 1);
  m.afterAugmentedMatch(g, { id: 'm7' });
  assert.equal(g.augmentations.credits, 1);
  assert.equal(m.augmentationModifiers('power').homeRun, 0.08);
  assert.equal(m.augmentationModifiers('zone').walk, 0.035);
});
test('KBO draft starts only in its window and locks the previous season order for eleven rounds', () => {
  const g = e.newGame('kbo-lotte', '드래프트 검증', 'full', 850),
    draft = m.createRookieDraft(m.world);
  assert.throws(() => draft.action(g, { type: 'startDraft' }), /드래프트 기간/);
  g.phase = 'regular';
  g.day = Math.round((Date.parse('2026-09-21') - Date.parse(g.calendar.openingDate)) / 86400000);
  draft.action(g, { type: 'startDraft' });
  assert.equal(g.draft.rounds, 11);
  assert.equal(g.draft.orderYear, 2025);
  assert.equal(g.draft.order[0], 'kbo-kiwoom');
  assert.equal(g.draft.order.at(-1), 'kbo-lg');
  const expected = [...g.draft.order];
  g.standings.kbo.reverse();
  assert.deepEqual(g.draft.order, expected);
  const future = e.newGame('kbo-lotte', '다음 시즌 순번', 'full', 851);
  future.year = 2027;
  future.day = Math.round((Date.parse('2027-09-21') - Date.parse('2027-03-27')) / 86400000);
  future.calendar.openingDate = '2027-03-27';
  future.phase = 'regular';
  future.seasonStandings = { '2026:kbo': expected };
  draft.action(future, { type: 'startDraft' });
  assert.deepEqual(future.draft.order, [...expected].reverse());
  assert.equal(future.draft.orderYear, 2026);
});
