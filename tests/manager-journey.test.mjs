import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents: `export * from './tests/fixtures/engine';
export * from './apps/api/src/domain/manager-journey';
export * from './apps/api/src/domain/manager-career';
export * from './apps/api/src/domain/recruitment';
export * from './apps/api/src/domain/player-development';
export * from './apps/api/src/domain/match-media-reactions';
export * from './packages/shared/src/manager-ability';
export * from './packages/shared/src/manager-journey';
export * from './packages/shared/src/manager-traits';
export * from './packages/shared/src/match-media';
export * from './packages/shared/src/match-manager-review';
export * from './packages/shared/src/calendar';`,
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
  createManagerCareer,
  createRecruitment,
  prepareManagerJourney,
  selfManagerAbility,
  managerPlayingTrait,
  managerAbility,
  managerAbilityKeys,
  creditManagerExperience,
  observeManagerTraining,
  recordManagerMatch,
  recordManagerInternational,
  awardManagerAchievement,
  developPlayers,
  coachConnectionDiscount,
  postMatchConversation,
  matchManagerReview,
  gameDate,
  conversationReaction,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const game = () => e.newGame('kbo-lotte', '김승부', 'full', 5017);
const scores = () => ({ outs: 0, bases: [null, null, null], score: [0, 0] });
function result(g, id = 'review-1') {
  const hitter = g.roster.find((p) => p.pos !== 'P');
  const pitcher = g.roster.find((p) => p.pos === 'P');
  const before = scores(),
    after = { ...scores(), bases: [hitter.id, null, null], score: [1, 0] };
  return {
    id,
    day: g.day,
    date: gameDate(g),
    away: g.club,
    home: 'kbo-lg',
    awayScore: 1,
    homeScore: 0,
    innings: [],
    hits: [1, 0],
    errors: [0, 0],
    mvp: hitter.name,
    log: [
      {
        inning: 1,
        half: 0,
        text: `${hitter.name} 안타`,
        score: [1, 0],
        play: { batter: hitter.id, pitcher: pitcher.id, command: 'contactFocus', before, after },
      },
    ],
    managerReview: {
      version: 1,
      club: g.club,
      commands: [{ cursor: 0, kind: 'contactFocus' }],
      changes: [],
    },
    replayTeams: [
      { lineup: [hitter.id], defense: { P: pitcher.id }, players: [hitter, pitcher] },
      { lineup: [], defense: {}, players: [] },
    ],
  };
}

test('기존 시작 능력·가상 동료를 한 번만 생성하고 평판, 재접속, 이직에도 보존한다', () => {
  const g = game();
  delete g.managerCareer.journey;
  const seed = g.seed;
  const expected = managerAbility({
    id: `self:${g.manager}`,
    reputation: g.managerCareer.reputation,
  });
  prepareManagerJourney(g, world);
  assert.deepEqual(g.managerCareer.journey.baseAbility, expected);
  const journey = structuredClone(g.managerCareer.journey),
    ability = selfManagerAbility(g);
  g.managerCareer.reputation = 95;
  g.club = 'kbo-kia';
  g.year++;
  createManagerCareer(world).prepare(g);
  assert.deepEqual(g.managerCareer.journey, journey);
  assert.deepEqual(selfManagerAbility(g), ability);
  assert.equal(g.seed, seed);
  const companion = journey.connections[0];
  assert.equal(companion.origin, 'teammate');
  assert.equal(g.coachAssignments[companion.id].coach.real, false);
  assert.equal(
    Object.keys(g.coachAssignments).filter((id) => id.startsWith('coach-teammate-')).length,
    1,
  );
});

test('선수 경력별 특성이 양 팀 능력에 반영되고 경력이 없으면 보정하지 않는다', () => {
  const base = Object.fromEntries(managerAbilityKeys.map((k) => [k, 55]));
  for (const [position, key, value] of [
    ['포수', 'bullpen', 58],
    ['투수', 'bullpen', 59],
    ['유격수', 'tactics', 58],
    ['외야수', 'evaluation', 57],
  ]) {
    const background = { playingCareer: { position } };
    assert.ok(managerPlayingTrait(background));
    assert.equal(
      managerAbility({ id: 'x', reputation: 55, ability: base, background })[key],
      value,
    );
  }
  assert.deepEqual(managerAbility({ id: 'x', reputation: 55, ability: base }), base);
});

test('지도 경험은 중복·하루 상한을 지키며 평판과 독립해 실제 능력을 키운다', () => {
  const g = game(),
    initial = selfManagerAbility(g);
  for (let i = 0; i < 100; i++) creditManagerExperience(g, 'tactics', 5, 'same', 'same');
  assert.equal(g.managerCareer.journey.experience.tactics, 5);
  for (let i = 0; i < 100; i++) creditManagerExperience(g, 'tactics', 5, `other-${i}`, 'other');
  assert.equal(g.managerCareer.journey.experience.tactics, 10);
  for (let day = 0; day < 9; day++) {
    g.day++;
    creditManagerExperience(g, 'tactics', 10, 'match', 'match');
  }
  assert.equal(selfManagerAbility(g).tactics, initial.tactics + 1);
  const xp = g.managerCareer.journey.experience.tactics;
  g.day--;
  creditManagerExperience(g, 'tactics', 5, 'old', 'old');
  assert.equal(g.managerCareer.journey.experience.tactics, xp);
  g.managerCareer.status = 'unemployed';
  g.day += 2;
  creditManagerExperience(g, 'tactics', 5, 'jobless', 'jobless');
  assert.equal(g.managerCareer.journey.experience.tactics, xp);
});

test('훈련과 완료한 경기에서만 경험·제자·승수가 누적되고 중복 처리하지 않는다', () => {
  let g = game();
  const young = g.roster.find((p) => p.pos !== 'P');
  young.age = 19;
  young.potential = 99;
  for (let day = 0; day < 28; day++) {
    observeManagerTraining(g, young, 0.03);
    observeManagerTraining(g, young, 0.03);
    g.day++;
  }
  const relation = g.managerCareer.journey.connections.find((r) => r.id === young.id);
  assert.equal(relation.trainingDays, 28);
  assert.ok(relation.student);
  const r = result(g);
  recordManagerMatch(g, r);
  const journey = structuredClone(g.managerCareer.journey);
  recordManagerMatch(g, r);
  assert.deepEqual(g.managerCareer.journey, journey);
  assert.equal(journey.wins, 1);
  assert.ok(journey.achievements.some((a) => a.id === `student:${young.id}`));
  assert.ok(journey.achievements.some((a) => a.id === 'wins:1'));
  recordManagerInternational(g, { id: 'national', name: '국제 대회', players: [young.id] });
  recordManagerInternational(g, { id: 'national', name: '국제 대회', players: [young.id] });
  assert.equal(
    g.managerCareer.journey.achievements.filter((a) => a.id === `international:${young.id}`).length,
    1,
  );
  awardManagerAchievement(g, 'champion:2026', '시즌 우승', '우승');
  awardManagerAchievement(g, 'champion:2026', '시즌 우승', '우승');
  assert.equal(
    g.managerCareer.journey.achievements.filter((a) => a.id === 'champion:2026').length,
    1,
  );
});

test('실제 훈련 호출이 육성 경험을 주며 같은 날짜나 휴식에 추가 경험을 주지 않는다', () => {
  const g = game();
  const p = g.roster.find((p) => p.pos !== 'P');
  p.age = 19;
  p.contact = 50;
  p.potential = 99;
  delete p.development;
  developPlayers(g);
  assert.equal(g.managerCareer.journey.experience.development, 1);
  const xp = structuredClone(g.managerCareer.journey.experience);
  developPlayers(g);
  assert.deepEqual(g.managerCareer.journey.experience, xp);
  g.day++;
  g.training = 'rest';
  developPlayers(g);
  assert.deepEqual(g.managerCareer.journey.experience, xp);
});

test('미리 생성된 경기에는 경험이 없고 코치 위임 완료 후 양 팀 사용 기록이 복기에 남는다', () => {
  let g = game();
  g.phase = 'regular';
  g.day = 0;
  while (!e.nextFixture(g)) g.day++;
  const initial = structuredClone(g.managerCareer.journey);
  g = e.applyAction(g, { type: 'startMatch', matchCards: true });
  assert.deepEqual(g.managerCareer.journey, initial);
  g = e.applyAction(g, {
    type: 'delegateMatch',
    date: gameDate(g),
    playbackId: g.liveMatch.playbackId,
    timelineVersion: g.liveMatch.timelineVersion,
    cursor: 0,
  });
  assert.ok(g.history[0].managerReview);
  assert.ok(g.history[0].delegatedBy);
  assert.equal(g.managerCareer.journey.games, 1);
  assert.ok(g.managerCareer.journey.experience.tactics >= 3);
  for (const club of [g.history[0].home, g.history[0].away]) {
    const review = matchManagerReview(g.history[0], club);
    assert.equal(review.cards.length, 3);
    assert.ok(review.augmentation);
  }
});

test('카드 발동·무효화와 직접 사인 성공을 관측 기록 그대로 구단별로 나눈다', () => {
  const g = game(),
    r = result(g);
  r.matchCards = {
    version: 2,
    club: g.club,
    own: [{ id: 'ours', kind: 'nullify', grade: 'bronze' }],
    opponent: [{ id: 'theirs', kind: 'power', grade: 'gold' }],
    augmentation: 'contact',
    opponentAugmentation: 'power',
  };
  r.log[0].play.cards = { own: 'ours', opponent: 'theirs' };
  r.log[0].play.augmentations = { opponent: 'power', blocked: true };
  const own = matchManagerReview(r, g.club),
    opp = matchManagerReview(r, r.home);
  assert.equal(own.commands[0].source, '감독 직접 지시');
  assert.equal(own.commands[0].success, true);
  assert.equal(own.cards[0].name, '증강 무효화');
  assert.equal(opp.cards[0].name, '파워 스윙');
  assert.equal(opp.augmentation.row.play.augmentations.blocked, true);
  assert.equal(own.augmentation.row, undefined);
});

test('제자와 상대 팀 재회는 인터뷰에 기록되고 연속 시리즈에서는 반복하지 않는다', () => {
  const g = game(),
    p = g.roster.find((p) => p.pos !== 'P');
  observeManagerTraining(g, p, 0.1);
  const relation = g.managerCareer.journey.connections.find((r) => r.id === p.id);
  relation.matches = 5;
  const r = result(g);
  r.log[0].half = 1;
  recordManagerMatch(g, r);
  assert.equal(r.managerReview.reunions[0].id, p.id);
  assert.ok(postMatchConversation(g, r, 'LG').questions.some((q) => q.id === 'reunion'));
  g.day++;
  const next = result(g, 'next');
  next.log[0].half = 1;
  recordManagerMatch(g, next);
  assert.equal(next.managerReview.reunions, undefined);
});

test('함께한 코치의 연봉 기대치가 완화되고 친분 있는 선수의 긍정 대화만 보조한다', () => {
  const g = game();
  const companion = g.managerCareer.journey.connections[0];
  assert.equal(coachConnectionDiscount(g, companion.id), 0.05);
  const p = g.roster[0];
  p.mood = { value: 60 };
  p.age = 30;
  p.condition = 90;
  const context = { questions: [{ id: 'talk', room: 'team' }] };
  const a = conversationReaction(p, context, [{ id: 'talk', choice: 'support' }], false, 55, 50);
  const b = conversationReaction(p, context, [{ id: 'talk', choice: 'support' }], false, 55, 90);
  assert.ok(b.after > a.after);
  assert.ok(b.after - p.mood.value <= 2);
  assert.deepEqual(
    conversationReaction(p, context, [{ id: 'talk', choice: 'support' }], true, 55, 50),
    conversationReaction(p, context, [{ id: 'talk', choice: 'support' }], true, 55, 90),
  );
});

test('선수 시절 동료의 친분이 실제 코치 제안 수락에 반영되고 최종 계약으로 이어진다', () => {
  const base = game(),
    known = structuredClone(base),
    unknown = structuredClone(base);
  const id = base.managerCareer.journey.connections[0].id,
    coach = base.coachAssignments[id].coach;
  unknown.managerCareer.journey.connections[0].trust = 50;
  const expected = coach.salary * (1 + Math.max(0, coach.skill - base.reputation - 8) * 0.015);
  const proposal = { type: 'coachOffer', id, role: coach.role, salary: expected * 0.97, years: 2 };
  const recruitment = createRecruitment(world);
  for (const g of [known, unknown]) {
    recruitment.action(g, proposal);
    g.day += 2;
    recruitment.tick(g);
  }
  assert.equal(known.coachDeals[0].status, 'accepted');
  assert.equal(unknown.coachDeals[0].status, 'counter');
  assert.match(known.coachDeals[0].message, /함께한 인연/);
  const signed = e.applyAction(known, { type: 'signCoach', id: known.coachDeals[0].id });
  assert.ok(signed.staff.some((c) => c.id === id));
  assert.equal(signed.managerCareer.journey.connections[0].id, id);
});
