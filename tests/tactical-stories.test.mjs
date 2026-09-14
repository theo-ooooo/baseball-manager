import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-tactical-stories.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/tactical-duel';export * from './packages/shared/src/lineup-competition';export * from './packages/shared/src/calendar';export * from './packages/shared/src/match-media';export * from './packages/shared/src/match-commands';export * from './apps/api/src/domain/tactical-duel';export * from './apps/api/src/domain/lineup-competition';export * from './apps/api/src/domain/club-dynamics';export * from './apps/api/src/domain/match-timeline';export * from './apps/api/src/domain/match-simulation';export * from './apps/web/src/features/career/manager-flow';",
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
  tacticalRead,
  tacticalDuel,
  tacticalEvidence,
  recordTacticalEvidence,
  competitionAction,
  recordCompetitionMatch,
  prepareCompetitions,
  dailyReports,
  matchMorale,
  gameDate,
  conversationKey,
  matchCommandOptions,
  generateTimeline,
  createMatchSimulator,
  createPreparedMatchSimulator,
  managerStep,
} = createRequire(import.meta.url)(out);
function game(seed = 32) {
  const g = e.newGame('kbo-lotte', '수싸움 감독', 'short', seed, { preseason: false });
  g.news = [];
  g.weather.seed = 0;
  return g;
}
function observed(g, club, kind = 'power') {
  g.engagement.tactics ||= { observations: [] };
  g.engagement.tactics.observations.push(
    ...[1, 2].map((i) => ({
      id: `obs-${club}-${i}`,
      club,
      date: gameDate(g),
      pa: 36,
      power: kind === 'power' ? 24 : 0,
      patient: kind === 'patient' ? 24 : 0,
      steals: kind === 'running' ? 2 : 0,
      hr: 0,
      bb: 0,
    })),
  );
}
function completed(g) {
  const started = e.applyAction(g, { type: 'startMatch' });
  return e.applyAction(started, {
    type: 'completeMatch',
    cursor: started.liveMatch.timeline.log.length,
    timelineVersion: started.liveMatch.timelineVersion,
  });
}
function competitionSetup() {
  let g = game();
  const prospect = g.roster.find((p) => p.id === g.lineup[0]);
  prospect.age = 21;
  const veteran = g.roster.find((p) => p.pos !== 'P' && !g.lineup.includes(p.id));
  assert.ok(veteran);
  veteran.pos = prospect.pos;
  veteran.age = 32;
  veteran.squad = 'first';
  veteran.condition = 100;
  veteran.mood.role = 'regular';
  veteran.mood.value = 60;
  veteran.mood.recent = [false, false];
  delete veteran.mood.promise;
  const mediator = g.roster.find(
    (p) => p.pos !== 'P' && p.id !== prospect.id && p.id !== veteran.id,
  );
  mediator.age = 35;
  mediator.squad = 'first';
  g = e.applyAction(g, { type: 'followProspect', id: prospect.id, goal: 'starts' });
  g.engagement.prospects[0].starts = 1;
  const live = e.applyAction(g, { type: 'startMatch' }),
    result = live.liveMatch.timeline;
  return {
    g,
    result,
    prospect: g.roster.find((p) => p.id === prospect.id),
    veteran: g.roster.find((p) => p.id === veteran.id),
  };
}
function openCompetition() {
  const s = competitionSetup();
  s.g.engagement.prospects[0].starts = 2;
  matchMorale(s.g, s.result);
  recordCompetitionMatch(s.g, s.result);
  assert.equal(s.g.engagement.competitions?.length, 1);
  return { ...s, c: s.g.engagement.competitions[0] };
}
function sample(g, c, id, starters, prospectHits = 0) {
  const own = g.club,
    opponent = e.nextFixture(g).find((id) => id !== own);
  const log = [];
  for (const p of [c.veteran, c.prospect])
    if (starters.includes(p.id))
      for (let n = 0; n < 3; n++)
        log.push({
          inning: 1,
          half: 1,
          text: `${p.name} ${p.id === c.prospect.id && n < prospectHits ? '안타' : '삼진'}`,
          score: [0, 0],
          play: {
            batter: p.id,
            pitcher: g.starter,
            plateAppearance: true,
            before: { outs: 0, score: [0, 0] },
            after: { outs: 1, score: [0, 0] },
          },
        });
  return {
    id,
    day: g.day,
    date: gameDate(g),
    home: own,
    away: opponent,
    homeScore: 0,
    awayScore: 0,
    log,
    innings: [],
    hits: [],
    errors: [],
    mvp: '',
    replayTeams: [
      { club: opponent, lineup: [], players: [] },
      { club: own, lineup: starters, players: g.roster },
    ],
  };
}

test('Vacation progression preserves an unanswered competition for the returning manager without routing it through a playing-time reply', () => {
  const { g, c } = openCompetition();
  const vacation = e.applyAction(g, { type: 'startVacation', days: 2 });
  const progressed = e.applyAction(vacation, { type: 'managerContinue', count: 1 });
  assert.ok(progressed.day > g.day);
  const story = progressed.engagement.competitions.find((s) => s.id === c.id);
  assert.equal(story.status, 'decision');
  assert.equal(story.games, 0);
  const returned = e.applyAction(progressed, { type: 'endVacation' });
  assert.equal(managerStep(returned, !!e.nextFixture(returned), 'home').kind, 'decision');
  const answered = e.applyAction(returned, {
    type: 'respondCompetition',
    id: c.id,
    choice: 'compete',
  });
  assert.equal(answered.engagement.competitions.find((s) => s.id === c.id).status, 'trial');
});
test('Opponent reads only completed observations; current instructions and unknown future results do not leak into its response', () => {
  const g = game(),
    pair = e.nextFixture(g);
  assert.equal(tacticalDuel(g, ...pair).away.plan, 'balanced');
  observed(g, g.club);
  const before = structuredClone(g),
    duel = tacticalDuel(g, ...pair);
  assert.deepEqual(g, before);
  assert.equal((pair[0] === g.club ? duel.away : duel.home).plan, 'guardPower');
  g.instructions = { ...g.instructions, aggression: 0, patience: 100 };
  g.history = [];
  assert.deepEqual(tacticalDuel(g, ...pair), duel);
  for (const [kind, plan] of [
    ['running', 'holdRunners'],
    ['patient', 'attackZone'],
  ]) {
    g.engagement.tactics.observations = [];
    observed(g, g.club, kind);
    const d = tacticalDuel(g, ...pair);
    assert.equal((pair[0] === g.club ? d.away : d.home).plan, plan);
  }
});
test('Real game evidence records PA and result kinds once, stays bounded, and excludes friendlies', () => {
  const g = game(),
    res = e.applyAction(g, { type: 'startMatch' }).liveMatch.timeline;
  recordTacticalEvidence(g, res);
  const saved = structuredClone(g.engagement);
  recordTacticalEvidence(g, res);
  assert.deepEqual(g.engagement, saved);
  assert.equal(
    tacticalEvidence(res, 0).pa,
    res.log.filter((e) => e.half === 0 && e.play && e.play.plateAppearance !== false).length,
  );
  for (let n = 0; n < 9; n++) recordTacticalEvidence(g, { ...res, id: `bounded-${n}` });
  assert.equal(g.engagement.tactics.observations.length, 8);
  assert.equal(tacticalRead(g, g.club).games, 4);
  const count = g.engagement.tactics.observations.length;
  recordTacticalEvidence(g, { ...res, id: 'friendly', friendly: true });
  assert.equal(g.engagement.tactics.observations.length, count);
  for (let n = 0; n < 60; n++)
    recordTacticalEvidence(g, { ...res, id: `clubs-${n}`, away: g.club, home: `club-${n}` });
  assert.ok(g.engagement.tactics.observations.length <= 48);
});
test('Defense selection is fixture-bound, validates server input and freezes through commands and reloads', () => {
  const g = game(),
    pair = e.nextFixture(g),
    key = conversationKey(g, pair);
  for (const bad of [
    { key: 'yesterday', plan: 'balanced' },
    { key, plan: 'hacked' },
  ])
    assert.throws(() => e.applyAction(g, { type: 'setDefensivePlan', ...bad }), /확인/);
  const selected = e.applyAction(g, { type: 'setDefensivePlan', key, plan: 'guardPower' });
  assert.equal(selected.day, g.day);
  assert.equal(selected.seed, g.seed);
  assert.deepEqual(selected.roster, g.roster);
  let live = e.applyAction(selected, { type: 'startMatch' });
  const frozen = structuredClone(live.liveMatch.duel);
  assert.equal((pair[0] === g.club ? frozen.home : frozen.away).plan, 'guardPower');
  assert.throws(
    () => e.applyAction(live, { type: 'setDefensivePlan', key, plan: 'balanced' }),
    /시작 전/,
  );
  observed(live, live.club, 'running');
  const cursor = live.liveMatch.timeline.log.findIndex(
    (_, i) =>
      i > 0 &&
      matchCommandOptions(live.liveMatch, live.club, i).some(
        (o) => o.kind === 'swingAway' && !o.reason,
      ),
  );
  assert.ok(cursor > 0);
  const changed = e.applyAction(JSON.parse(JSON.stringify(live)), {
    type: 'matchCommand',
    command: 'swingAway',
    cursor,
    timelineVersion: live.liveMatch.timelineVersion,
  });
  assert.deepEqual(changed.liveMatch.duel, frozen);
  assert.deepEqual(
    changed.liveMatch.timeline.log.slice(0, cursor),
    live.liveMatch.timeline.log.slice(0, cursor),
  );
  assert.deepEqual(changed.liveMatch.timeline.duel, frozen);
});
test('Each defensive response changes actual same-seed simulations, while both teams use the same response rules', () => {
  const effects = new Set();
  for (let seed = 1; seed <= 24; seed++) {
    const g = game(seed),
      pair = e.nextFixture(g),
      key = conversationKey(g, pair);
    const neutral = e.applyAction(g, { type: 'startMatch' }).liveMatch.timeline;
    for (const plan of ['guardPower', 'attackZone', 'holdRunners']) {
      const ready = e.applyAction(g, { type: 'setDefensivePlan', key, plan }),
        live = e.applyAction(ready, { type: 'startMatch' }),
        result = live.liveMatch.timeline;
      if (JSON.stringify(result.log) !== JSON.stringify(neutral.log)) effects.add(plan);
      const own = pair[0] === g.club ? 'home' : 'away',
        opp = own === 'home' ? 'away' : 'home';
      assert.equal(result.duel[own].plan, plan);
      assert.equal(result.duel[opp].plan, 'balanced');
    }
  }
  assert.deepEqual(effects, new Set(['guardPower', 'attackZone', 'holdRunners']));
  const g = game();
  observed(g, g.club, 'power');
  observed(
    g,
    e.nextFixture(g).find((id) => id !== g.club),
    'power',
  );
  const final = completed(g);
  assert.equal(final.history[0].duel.home.plan, 'guardPower');
  assert.equal(final.history[0].duel.away.plan, 'guardPower');
  assert.equal(final.engagement.tactics.observations.length, 6);
});
test('A legacy live match without a tactical snapshot remains neutral on regeneration and prepared commands', () => {
  const g = e.applyAction(game(), { type: 'startMatch' });
  delete g.liveMatch.duel;
  generateTimeline(g, createMatchSimulator(world));
  const legacy = structuredClone(g.liveMatch.timeline);
  observed(g, g.club, 'running');
  observed(g, g.liveMatch.home === g.club ? g.liveMatch.away : g.liveMatch.home, 'power');
  generateTimeline(g, createPreparedMatchSimulator('kbo'));
  assert.deepEqual(g.liveMatch.timeline, legacy);
  assert.equal(g.liveMatch.timeline.duel, undefined);
  assert.ok(g.liveMatch.timeline.log.every((e) => !e.play?.battingIntent));
});
test('A real prospect start after three healthy veteran absences opens one connected decision and reading cannot bypass it', () => {
  const { g, result, c } = openCompetition();
  assert.equal(c.status, 'decision');
  const news = g.news.find((n) => n.competitionId === c.id && n.choiceKind);
  news.read = true;
  assert.equal(managerStep(g, true, 'home').kind, 'decision');
  const saved = structuredClone(g);
  recordCompetitionMatch(g, result);
  assert.deepEqual(g, saved);
  assert.throws(
    () => e.applyAction(g, { type: 'respondNews', id: news.id, choice: 'promise' }),
    /답변|선택|확인/,
  );
  assert.throws(
    () => competitionAction(g, { type: 'respondCompetition', id: c.id, choice: 'fake' }),
    /선택/,
  );
  const next = e.applyAction(g, { type: 'respondCompetition', id: c.id, choice: 'compete' });
  assert.equal(next.engagement.competitions[0].status, 'trial');
  assert.throws(
    () => competitionAction(next, { type: 'respondCompetition', id: c.id, choice: 'compete' }),
    /확인/,
  );
  assert.equal(next.news.find((n) => n.id === news.id).choice, 'compete');
});
test('Injured veterans, normal pitcher rotation and different positions do not create a displacement story', () => {
  for (const scenario of ['injury', 'pitcher', 'different', 'bench']) {
    const { g, result, prospect, veteran } = competitionSetup();
    g.engagement.prospects[0].starts = 2;
    veteran.mood.recent = [false, false, false];
    if (scenario === 'injury') veteran.injury = { kind: 'test', days: 3 };
    if (scenario === 'pitcher') {
      prospect.pos = 'P';
      veteran.pos = 'P';
    }
    if (scenario === 'different') veteran.pos = prospect.pos === 'C' ? '1B' : 'C';
    if (scenario === 'bench') veteran.mood.role = 'rotation';
    recordCompetitionMatch(g, result);
    assert.equal(g.engagement.competitions, undefined, scenario);
  }
});
test('Six completed games evaluate real starts and batting, reward once and impose a cooldown', () => {
  const { g, c } = openCompetition();
  competitionAction(g, { type: 'respondCompetition', id: c.id, choice: 'compete' });
  const veteran = g.roster.find((p) => p.id === c.veteran.id),
    prospect = g.roster.find((p) => p.id === c.prospect.id);
  const initial = [veteran.mood.value, prospect.mood.value];
  for (let n = 0; n < 6; n++) {
    const result = sample(g, c, `trial-${n}`, [n % 2 ? c.veteran.id : c.prospect.id], 1);
    recordCompetitionMatch(g, result);
    recordCompetitionMatch(g, result);
  }
  assert.equal(c.games, 6);
  assert.equal(c.status, 'resolved');
  assert.equal(c.kept, true);
  assert.equal(c.veteran.starts, 3);
  assert.equal(c.prospect.starts, 3);
  assert.equal(c.prospect.ab, 9);
  assert.equal(c.prospect.h, 3);
  assert.equal(veteran.mood.value, initial[0] + 4);
  assert.equal(prospect.mood.value, initial[1] + 6);
  assert.match(c.outcome, /타율이 더 높/);
  assert.equal(g.engagement.competitions.length, 1);
  const saved = structuredClone(g);
  recordCompetitionMatch(g, sample(g, c, 'trial-5', [c.veteran.id]));
  assert.deepEqual(g, saved);
});
test('Missed promises lower only the affected player morale; injury pauses and season end cancels without a false penalty', () => {
  const { g, c } = openCompetition();
  competitionAction(g, { type: 'respondCompetition', id: c.id, choice: 'compete' });
  const veteran = g.roster.find((p) => p.id === c.veteran.id),
    prospect = g.roster.find((p) => p.id === c.prospect.id);
  const v = veteran.mood.value,
    p = prospect.mood.value;
  prospect.injury = { kind: 'test', days: 3 };
  recordCompetitionMatch(g, sample(g, c, 'injured', [c.veteran.id]));
  assert.equal(c.games, 0);
  delete prospect.injury;
  for (let n = 0; n < 6; n++)
    recordCompetitionMatch(g, sample(g, c, `missed-${n}`, [c.prospect.id]));
  assert.equal(c.kept, false);
  assert.equal(veteran.mood.value, v - 6);
  assert.equal(prospect.mood.value, p + 4);
  const other = openCompetition(),
    before = other.veteran.mood.value;
  other.g.phase = 'finished';
  prepareCompetitions(other.g);
  assert.equal(other.c.status, 'resolved');
  assert.equal(other.veteran.mood.value, before);
  assert.match(other.c.outcome, /불이행 불이익을 주지/);
});
test('Backing the prospect changes the veteran role once; mediation needs a real available teammate; trial avoids duplicate playing-time demands', () => {
  const a = openCompetition();
  competitionAction(a.g, { type: 'respondCompetition', id: a.c.id, choice: 'backProspect' });
  assert.equal(a.veteran.mood.role, 'rotation');
  assert.equal(a.c.choice, 'backProspect');
  const b = openCompetition();
  b.c.mediator = undefined;
  assert.throws(
    () => competitionAction(b.g, { type: 'respondCompetition', id: b.c.id, choice: 'mediate' }),
    /중재/,
  );
  assert.equal(b.c.status, 'decision');
  const c = openCompetition();
  competitionAction(c.g, { type: 'respondCompetition', id: c.c.id, choice: 'mediate' });
  assert.equal(typeof c.c.mediation, 'boolean');
  c.veteran.mood.value = 30;
  c.veteran.mood.recent = Array(12).fill(false);
  c.veteran.mood.lastPlayedDay = -1;
  dailyReports(c.g, world);
  assert.ok(
    !c.g.news.some(
      (n) => n.playerId === c.veteran.id && n.choiceKind === 'playingTime' && !n.choice,
    ),
  );
  c.g.roster = c.g.roster.filter((p) => p.id !== c.prospect.id);
  prepareCompetitions(c.g);
  assert.equal(c.c.status, 'resolved');
  assert.match(c.c.outcome, /선수 이동/);
});
