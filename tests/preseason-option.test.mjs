import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-preseason-option-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/preseason.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  world,
  engine: e,
  gameDate,
  addDays,
  createCalendarView,
  PRESEASON_DAYS,
  preseasonSkipBlockers,
  managerStep,
} = createRequire(import.meta.url)(out);
const calendar = createCalendarView(world);
const blankStats = (g) => g.roster.every((p) => p.stats.g === 0 && p.stats.ab === 0);

test('A new career can open on the league fixture date with a consistent phase, contract and first game', () => {
  const g = e.newGame('kbo-lotte', '개막 감독', 'short', 91, { preseason: false });
  assert.equal(g.day, 0);
  assert.equal(g.phase, 'regular');
  assert.equal(g.rules.preseason, false);
  assert.equal(g.rules.startYear, world.year);
  assert.equal(gameDate(g), g.calendar.openingDate);
  assert.equal(g.calendar.openingDate, calendar.opening(g, 'kbo'));
  assert.equal(g.managerCareer.status, 'employed');
  assert.equal(g.managerCareer.contract.signed, g.calendar.openingDate);
  assert.ok(g.news.some((n) => n.body.includes('프리시즌 없이')));
  assert.ok(!g.news.some((n) => n.body.includes('4주간의 프리시즌')));
  assert.ok(blankStats(g));
  // The season target can still be negotiated on the appointment date itself.
  const targeted = e.applyAction(g, { type: 'managerTarget', targetRank: 3 });
  assert.equal(targeted.managerCareer.contract.targetRank, 3);
  // Opening day already holds an official fixture; nothing is a friendly.
  assert.ok(e.nextFixture(g));
  assert.equal(
    managerStep(e.applyAction(g, { type: 'readAllNews' }), true, 'home').kind,
    'matchday',
  );
  const played = e.advance(structuredClone(g), 1);
  assert.equal(played.day, 1);
  assert.ok(played.history.length >= 1);
  assert.ok(played.history.every((r) => !r.friendly));
  assert.ok(played.roster.some((p) => p.stats.g > 0));
  assert.ok(played.standings.kbo.some((s) => s.w + s.l + s.d > 0));
  // The default remains the four-week preseason for callers that omit the option.
  const classic = e.newGame('kbo-lotte', '기본 감독', 'short', 91);
  assert.equal(classic.day, -PRESEASON_DAYS);
  assert.equal(classic.phase, 'preseason');
  assert.equal(classic.rules.preseason, true);
});

test('An unemployed start without preseason begins job hunting on opening day and the world keeps playing', () => {
  let g = e.newGame('kbo-lg', '', 'short', 92, { unemployed: true, preseason: false });
  assert.equal(g.day, 0);
  assert.equal(g.phase, 'regular');
  assert.equal(g.rules.preseason, false);
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.equal(g.managerCareer.contract, undefined);
  assert.equal(g.managerCareer.unemployedSince, g.calendar.openingDate);
  assert.equal(g.managerCareer.unemployedSince, gameDate(g));
  assert.ok(g.news.some((n) => n.kind === 'manager' && n.body.includes('개막일부터')));
  assert.equal(g.managerJobs['kbo-lg'].managerName, '염경엽');
  // Nothing to delegate: an unemployed manager cannot issue club commands.
  assert.throws(() => e.applyAction(g, { type: 'skipPreseason' }), /무직/);
  g = e.applyAction(g, { type: 'managerContinue', count: 3 });
  assert.equal(g.day, 3);
  assert.equal(g.phase, 'regular');
  assert.equal(g.managerCareer.status, 'unemployed');
  assert.ok(g.standings.kbo.reduce((s, r) => s + r.w, 0) > 0);
});

test('Other leagues open on their own fixture date, including official full-length schedules', () => {
  for (const [league, mode] of [
    ['mlb', 'full'],
    ['npb', 'short'],
    ['kbo', 'full'],
  ]) {
    const club = world.clubs.find((c) => c.league === league).id;
    const g = e.newGame(club, '리그 감독', mode, 93, { preseason: false });
    assert.equal(g.day, 0, league);
    assert.equal(g.phase, 'regular', league);
    assert.equal(g.calendar.openingDate, calendar.opening(g, league), league);
    assert.equal(gameDate(g), g.calendar.openingDate, league);
    assert.ok(calendar.onDate(g, league).length > 0, `${league} plays on its opening date`);
    assert.equal(g.managerCareer.contract.signed, g.calendar.openingDate, league);
    if (mode === 'full')
      assert.equal(
        g.calendar.openingDate,
        world.fixtures
          .filter((f) => f.league === league)
          .sort((a, b) => a.date.localeCompare(b.date))[0].date,
        `${league} official opening`,
      );
  }
});

test('Skipping an existing preseason runs every remaining day for the coaches and stops on opening day', () => {
  let g = e.newGame('kbo-lotte', '위임 감독', 'short', 94);
  g = e.advance(g, 5);
  assert.equal(g.day, -23);
  assert.equal(g.phase, 'preseason');
  const original = structuredClone(g);
  const injured = g.roster.find((p) => p.squad === 'first' && p.pos !== 'P');
  injured.injury = {
    id: 'test-injury',
    name: '햄스트링 염좌',
    occurred: gameDate(g),
    returnDate: addDays(gameDate(g), 10),
    earliestReturn: addDays(gameDate(g), 7),
    severity: 'minor',
    phase: 'treatment',
    recurrenceRisk: 10,
  };
  g.news.push({
    id: 'pending-chat',
    day: g.day,
    title: '출전 시간 면담',
    body: '답변 필요',
    kind: 'morale',
    playerId: g.lineup[0],
    choiceKind: 'playingTime',
  });
  g.roster.find((p) => p.id === g.lineup[0]).mood ??= { value: 60, recent: [] };
  const next = e.applyAction(g, { type: 'skipPreseason' });
  assert.equal(next.day, 0);
  assert.equal(next.phase, 'regular');
  assert.deepEqual(
    { from: next.progress.from, to: next.progress.to, stop: next.progress.stop },
    { from: -23, to: 0, stop: 'season' },
  );
  const arrived = next.news.filter((n) => next.progress.newsIds.includes(n.id));
  assert.ok(arrived.some((n) => n.title === '정규시즌 개막'));
  assert.ok(arrived.some((n) => n.title.startsWith('프리시즌 위임 완료')));
  // Friendlies were played by the coaches and stay out of the official record.
  assert.equal(next.history.filter((r) => r.friendly).length, 4);
  assert.ok(next.history.every((r) => r.friendly));
  assert.ok(blankStats(next));
  for (const s of next.standings.kbo) assert.equal(s.w + s.l + s.d, 0);
  // Wages, manager salary and injury recovery were processed day by day.
  assert.equal(next.finances.settledDays, original.finances.settledDays + 23);
  assert.ok(next.managerCareer.earnings > original.managerCareer.earnings);
  assert.ok(next.expenses > original.expenses);
  assert.equal(next.roster.find((p) => p.id === injured.id).injury, undefined);
  assert.ok(next.news.some((n) => n.playerId === injured.id && n.title.includes('복귀')));
  // Unsupported preseason playing-time demands are resolved without creating promises.
  assert.equal(next.news.find((n) => n.id === 'pending-chat').choice, 'resolved');
  assert.equal(next.news.filter((n) => n.choiceKind && !n.choice).length, 0);
  // Nothing about the career was reset.
  assert.equal(next.year, original.year);
  assert.equal(next.club, original.club);
  assert.equal(next.manager, original.manager);
  assert.deepEqual(next.rules, original.rules);
  assert.deepEqual(next.past, original.past);
  assert.deepEqual(next.managerCareer.history, original.managerCareer.history);
  assert.deepEqual(next.managerCareer.contract, original.managerCareer.contract);
  assert.deepEqual(next.roster.map((p) => p.id).sort(), original.roster.map((p) => p.id).sort());
  assert.equal(next.calendar.openingDate, original.calendar.openingDate);
  for (const res of original.worldResults || [])
    assert.ok(
      next.worldResults.some((r) => r.id === res.id),
      'earlier world results survive',
    );
  // The command itself did not mutate the input save, so a retry sees the same starting point.
  assert.equal(g.day, -23);
  assert.equal(g.phase, 'preseason');
  // The regular season proceeds normally from opening day.
  const played = e.advance(structuredClone(next), 1);
  assert.ok(played.history.some((r) => !r.friendly));
  assert.equal(played.rules.preseason, true);
});

test('Skipping is refused during a live match, outside the preseason, on vacation and while the manager owes an answer', () => {
  const g = e.newGame('kbo-lotte', '거부 감독', 'short', 95);
  const today = gameDate(g);
  assert.throws(
    () => e.applyAction({ ...g, day: -100 }, { type: 'skipPreseason' }),
    /프리시즌 날짜/,
  );
  assert.throws(() => e.applyAction({ ...g, day: 0 }, { type: 'skipPreseason' }), /프리시즌 날짜/);
  const trade = structuredClone(g);
  trade.trades = [{ id: 'trade-waiting', club: 'kbo-lg', status: 'counter', expires: today }];
  assert.throws(() => e.applyAction(trade, { type: 'skipPreseason' }), /트레이드 답변 1건/);
  assert.throws(
    () => e.applyAction(g, { type: 'skipPreseason', futureSeasons: 'yes' }),
    /다음 시즌/,
  );
  const live = structuredClone(g);
  live.liveMatch = { home: 'kbo-lotte', away: 'kbo-lg', seed: 1 };
  assert.throws(() => e.applyAction(live, { type: 'skipPreseason' }), /진행 중인 경기/);
  const regular = e.applyAction(g, { type: 'skipPreseason' });
  assert.throws(() => e.applyAction(regular, { type: 'skipPreseason' }), /프리시즌 중에만/);
  const vacation = e.applyAction(g, { type: 'startVacation', days: 3 });
  assert.throws(() => e.applyAction(vacation, { type: 'skipPreseason' }), /휴가/);
  const offered = structuredClone(g);
  offered.managerCareer.offers.push({
    id: 'offer-lg',
    club: 'kbo-lg',
    targetRank: 4,
    salary: 1,
    applied: today,
    due: today,
    expires: addDays(today, 10),
    status: 'offered',
    message: '',
  });
  assert.throws(() => e.applyAction(offered, { type: 'skipPreseason' }), /감독 면접·계약 제안 1건/);
  assert.equal(preseasonSkipBlockers(offered)[0].kind, 'managerOffer');
  const expired = structuredClone(offered);
  expired.managerCareer.offers[0].expires = addDays(today, -1);
  assert.equal(preseasonSkipBlockers(expired).length, 0);
  const deal = structuredClone(g);
  deal.deals.push({
    id: 'deal-1',
    player: g.roster[0],
    type: 'renew',
    salary: 1,
    years: 1,
    fee: 0,
    agentFee: 0,
    status: 'accepted',
    message: '',
    day: g.day,
    year: g.year,
    expires: g.day + 7,
  });
  assert.throws(() => e.applyAction(deal, { type: 'skipPreseason' }), /선수 계약 답변 1건/);
  const sale = structuredClone(g);
  sale.saleOffers = [
    {
      id: 'sale-1',
      playerId: g.roster[1].id,
      club: 'kbo-lg',
      fee: 5,
      day: g.day,
      expires: g.day + 5,
      year: g.year,
    },
  ];
  assert.throws(() => e.applyAction(sale, { type: 'skipPreseason' }), /선수 매각 제안 1건/);
  const draft = structuredClone(g);
  draft.draft = {
    year: g.year,
    league: 'kbo',
    mode: 'draft',
    status: 'open',
    round: 1,
    order: [],
    cursor: 0,
    prospects: [],
    picks: [],
  };
  assert.throws(() => e.applyAction(draft, { type: 'skipPreseason' }), /신인 선발 1건/);
  // None of the refused commands changed the save.
  assert.equal(g.day, -PRESEASON_DAYS);
  assert.equal(g.phase, 'preseason');
});

test('A job application answered mid-skip stops before opening day without expiring it, then the skip resumes', () => {
  let g = e.newGame('kbo-lotte', '중단 감독', 'short', 96);
  Object.assign(g.managerJobs['kbo-lg'], { vacant: true, confidence: 0 });
  g = e.applyAction(g, { type: 'applyManager', club: 'kbo-lg', targetRank: 4 });
  assert.equal(
    preseasonSkipBlockers(g).length,
    0,
    'a pending application is the club’s turn, not the manager’s',
  );
  const before = g;
  g = e.applyAction(g, { type: 'skipPreseason' });
  assert.equal(g.phase, 'preseason');
  assert.equal(g.day, before.day + 3);
  assert.equal(g.progress.stop, 'report');
  const offer = g.managerCareer.offers.find((o) => o.club === 'kbo-lg');
  assert.equal(offer.status, 'interview');
  assert.ok(offer.expires >= gameDate(g));
  assert.ok(g.news.some((n) => g.progress.newsIds.includes(n.id) && n.managerOfferId === offer.id));
  assert.ok(g.news.some((n) => n.title.startsWith('프리시즌 위임 중단')));
  assert.equal(managerStep(g, false, 'home').kind, 'report');
  assert.equal(preseasonSkipBlockers(g).length, 1);
  assert.throws(() => e.applyAction(g, { type: 'skipPreseason' }), /감독 면접·계약 제안/);
  g = e.applyAction(g, { type: 'declineManager', id: offer.id });
  g = e.applyAction(g, { type: 'skipPreseason' });
  assert.equal(g.day, 0);
  assert.equal(g.phase, 'regular');
  assert.equal(g.progress.stop, 'season');
  assert.equal(g.history.filter((r) => r.friendly).length, 4);
});

test('Dropping future preseasons is honoured by the next season while the default rule keeps them', () => {
  let g = e.newGame('kbo-lotte', '규칙 감독', 'short', 97);
  g = e.applyAction(g, { type: 'skipPreseason', futureSeasons: true });
  assert.equal(g.day, 0);
  assert.equal(g.rules.preseason, false);
  assert.equal(g.rules.startYear, world.year);
  assert.ok(g.news.some((n) => n.body.includes('다음 시즌부터는 프리시즌 없이')));
  let safe = 0;
  while (g.phase !== 'finished' && safe++ < 14) g = e.advance(g, 7);
  assert.equal(g.phase, 'finished');
  g = e.nextSeason(g);
  assert.equal(g.year, world.year + 1);
  assert.equal(g.day, 0);
  assert.equal(g.phase, 'regular');
  assert.equal(gameDate(g), g.calendar.openingDate);
  assert.equal(
    e.nextFixture(g) !== null,
    calendar.onDate(g, 'kbo').some((f) => f.home === g.club || f.away === g.club),
  );
});
