import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-coach-substitution-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/web/src/features/matches/coach-substitution';export * from './apps/web/src/features/matches/match-plan-state';export * from './packages/shared/src/coach-assessment';export * from './packages/shared/src/coach-directory';export * from './packages/shared/src/match-energy';export * from './packages/shared/src/match-decision';export * from './packages/shared/src/management';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
});
const {
  engine: e,
  coachSubstitution,
  coachAssessment,
  coachJudgment,
  coachDirectory,
  coachEmployer,
  matchPlanAt,
  matchDecision,
  familiarity,
} = createRequire(import.meta.url)(output);
const start = (seed = 407) => {
  const g = e.newGame('kbo-lotte', 'Coach QA', 'full', seed);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch' });
};
function advice(g, kind = 'pitcher') {
  for (let cursor = 1; cursor < g.liveMatch.timeline.log.length; cursor++) {
    const suggestion = coachSubstitution(g, cursor);
    if (suggestion?.kind === kind) return { cursor, suggestion };
  }
  return null;
}

test('Coach judgment is stable, improves assessment precision, and spots fatigue earlier', () => {
  const g = start(),
    p = g.roster.find((p) => p.pos === 'P'),
    c = g.staff.find((c) => c.role === '투수');
  const weak = { ...c, skill: 20 },
    strong = { ...c, skill: 90 };
  const exact = p.stuff * 0.55 + p.control * 0.45;
  assert.ok(
    Math.abs(coachAssessment(strong, p, true) - exact) <
      Math.abs(coachAssessment(weak, p, true) - exact),
  );
  assert.equal(coachAssessment(strong, p, true), coachAssessment({ ...strong }, { ...p }, true));
  assert.ok(coachJudgment(strong).fatigue > coachJudgment(weak).fatigue);
  assert.ok(coachJudgment(strong).minimumGain < coachJudgment(weak).minimumGain);
});

test('Recommendation uses assigned coach and only completed plays; no phantom vacant-role coach', () => {
  const g = start(),
    found = advice(g);
  assert.ok(found);
  const { cursor, suggestion } = found;
  assert.equal(suggestion.coach, g.staff.find((c) => c.role === '투수').name);
  const prefixOnly = structuredClone(g);
  prefixOnly.liveMatch.timeline.log.splice(cursor, Infinity, {
    inning: 99,
    half: 1,
    score: [100, 100],
    text: 'future hidden',
  });
  assert.deepEqual(coachSubstitution(prefixOnly, cursor), suggestion);
  const missing = structuredClone(g);
  missing.staff = missing.staff.filter((c) => c.role !== '투수');
  assert.equal(coachSubstitution(missing, cursor), undefined);
  assert.equal(coachSubstitution(g, 0), undefined);
  assert.equal(coachSubstitution(g, g.liveMatch.timeline.log.length), undefined);
});

test('Coach recommendation is applied by server before the next play, retaining all consumed results', () => {
  const g = start(),
    { cursor, suggestion } = advice(g);
  const before = structuredClone(g.liveMatch.timeline.log.slice(0, cursor));
  assert.equal(suggestion.emergency, true);
  assert.match(suggestion.preparation, /대기/);
  const next = e.applyAction(g, {
    type: 'reviseMatch',
    ...suggestion.plan,
    emergency: suggestion.emergency,
    cursor,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  assert.deepEqual(next.liveMatch.timeline.log.slice(0, cursor), before);
  assert.equal(next.liveMatch.timeline.log[cursor].play.pitcher, suggestion.incoming.id);
  assert.equal(next.liveMatch.changes.at(-1).coldEntry, true);
  assert.ok(matchPlanAt(next, cursor).usedPitchers.has(suggestion.incoming.id));
  assert.equal(next.liveMatch.timelineVersion, g.liveMatch.timelineVersion + 1);
  assert.throws(
    () =>
      e.applyAction(next, {
        type: 'reviseMatch',
        ...suggestion.plan,
        cursor,
        timelineVersion: g.liveMatch.timelineVersion,
      }),
    /경기|버전/,
  );
});

test('A warmed recommended pitcher needs no emergency penalty and invalid reserve selection is rejected', () => {
  const g = start(),
    { cursor, suggestion } = advice(g);
  const warmed = e.applyAction(g, {
    type: 'bullpen',
    id: suggestion.incoming.id,
    mode: 'warm',
    cursor: Math.max(g.liveMatch.cursor, cursor - 3),
    timelineVersion: g.liveMatch.timelineVersion,
  });
  const ready = coachSubstitution(warmed, cursor);
  assert.ok(ready);
  assert.equal(ready.incoming.id, suggestion.incoming.id);
  assert.equal(ready.emergency, false);
  const next = e.applyAction(warmed, {
    type: 'reviseMatch',
    ...ready.plan,
    cursor,
    timelineVersion: warmed.liveMatch.timelineVersion,
  });
  assert.ok(!next.liveMatch.changes.at(-1).coldEntry);
  const reserve = g.roster.find((p) => p.pos === 'P' && p.squad === 'reserve');
  assert.throws(
    () =>
      e.applyAction(g, {
        type: 'reviseMatch',
        ...suggestion.plan,
        pitcher: reserve.id,
        cursor,
        timelineVersion: g.liveMatch.timelineVersion,
      }),
    /1군|선수|투수/,
  );
});

test('Pitcher advice never uses the closer in a blowout or recommends a used pitcher', () => {
  const g = start(),
    { cursor } = advice(g),
    own = g.liveMatch.home === g.club ? 1 : 0;
  const row = g.liveMatch.timeline.log[cursor - 1];
  row.score[own] = 0;
  row.score[1 - own] = 10;
  const suggestion = coachSubstitution(g, cursor);
  assert.ok(suggestion);
  assert.notEqual(suggestion.incoming.id, g.pitching.closer);
  assert.ok(!matchPlanAt(g, cursor).usedPitchers.has(suggestion.incoming.id));
  assert.ok(suggestion.incoming.squad !== 'reserve');
});

test('Pinch hitter recommendation changes only the upcoming batting slot with legal defense', () => {
  const g = start(),
    original = structuredClone(g);
  let cursor;
  for (let i = 1; i < g.liveMatch.timeline.log.length; i++) {
    const d = matchDecision(g.liveMatch, g.club, i);
    if (d.attacking && d.inning >= 7) {
      cursor = i;
      break;
    }
  }
  assert.ok(cursor);
  const d = matchDecision(g.liveMatch, g.club, cursor);
  const current = g.roster.find((p) => p.id === d.batterId);
  const { plan } = matchPlanAt(g, cursor);
  const position = Object.keys(plan.defense).find((pos) => plan.defense[pos] === current.id);
  const bench = g.roster.find(
    (p) => p.pos !== 'P' && p.squad !== 'reserve' && !plan.lineup.includes(p.id),
  );
  Object.assign(bench, {
    contact: 99,
    power: 99,
    condition: 100,
    familiarity: { [position]: 100 },
  });
  Object.assign(current, { contact: 10, power: 10, condition: 20 });
  for (const entry of g.liveMatch.timeline.log.slice(0, cursor)) {
    if (entry.play?.energy) delete entry.play.energy;
  }
  for (const team of g.liveMatch.timeline.replayTeams) {
    for (const p of team.players) if (p.id === current.id) p.condition = 20;
  }
  const suggestion = coachSubstitution(g, cursor);
  assert.ok(suggestion);
  assert.equal(suggestion.kind, 'batter');
  assert.equal(suggestion.incoming.id, bench.id);
  assert.equal(suggestion.plan.lineup[d.slot], bench.id);
  assert.equal(suggestion.plan.defense[position], bench.id);
  assert.equal(suggestion.plan.pitcher, plan.pitcher);
  assert.equal(suggestion.plan.lineup.filter((id, i) => id !== plan.lineup[i]).length, 1);
  const before = structuredClone(original.liveMatch.timeline.log.slice(0, cursor));
  const next = e.applyAction(original, {
    type: 'reviseMatch',
    ...suggestion.plan,
    cursor,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  assert.deepEqual(next.liveMatch.timeline.log.slice(0, cursor), before);
  assert.equal(next.liveMatch.timeline.log[cursor].play.batter, bench.id);
});

test('Actual coach employer overrides historical source, releases remain free, directory deduplicates', () => {
  const g = start(),
    c = g.staff[0],
    foreign = e.coachPool().find((c) => c.sourceClub && c.sourceClub !== g.club);
  assert.equal(coachEmployer(g, c), g.club);
  assert.equal(coachEmployer(g, foreign), foreign.sourceClub);
  g.coachAssignments = {
    [foreign.id]: { club: g.club, coach: foreign },
    [c.id]: { club: 'fa', coach: c },
  };
  g.staff = g.staff.filter((s) => s.id !== c.id);
  const entries = coachDirectory(g, e.coachPool());
  assert.equal(entries.find((x) => x.coach.id === foreign.id).club, g.club);
  assert.equal(entries.find((x) => x.coach.id === c.id).club, 'fa');
  assert.equal(entries.filter((x) => x.coach.id === foreign.id).length, 1);
  g.coachAssignments[foreign.id].coach = { ...foreign, contractUntil: g.year };
  assert.equal(coachEmployer(g, foreign), 'fa');
});

test('Signing a foreign coach updates actual employer and releases the outgoing coach without changing catalog history', async () => {
  const { waitForReply } = await import('./helpers/recruitment.mjs');
  let g = e.newGame('kbo-lotte', 'Coach employers', 'full', 76);
  const candidate = e.coachPool().find((c) => c.sourceClub && c.sourceClub !== g.club);
  const outgoing = g.staff.find((c) => c.role === '투수');
  const source = candidate.sourceClub;
  g = e.applyAction(g, {
    type: 'coachOffer',
    id: candidate.id,
    role: '투수',
    salary: candidate.salary * 3,
    years: 2,
  });
  assert.equal(coachEmployer(g, candidate), source);
  const id = g.coachDeals[0].id;
  g = waitForReply(e, g, id, true);
  assert.equal(g.coachDeals[0].status, 'accepted');
  g = e.applyAction(g, { type: 'signCoach', id });
  assert.equal(coachEmployer(g, candidate), g.club);
  assert.equal(coachEmployer(g, outgoing), 'fa');
  assert.equal(g.staff.find((c) => c.id === candidate.id).sourceClub, source);
  const reloaded = JSON.parse(JSON.stringify(g));
  const rows = coachDirectory(reloaded, e.coachPool());
  assert.equal(rows.filter((r) => r.coach.id === candidate.id).length, 1);
  assert.equal(rows.find((r) => r.coach.id === candidate.id).club, g.club);
  // A displaced real coach can negotiate again, without being restored to their catalog club.
  g = e.applyAction(g, {
    type: 'coachOffer',
    id: outgoing.id,
    role: '타격',
    salary: outgoing.salary * 2,
    years: 2,
  });
  assert.equal(g.coachDeals[0].coach.id, outgoing.id);
});

/**
 * 수비가 약한 야수와 확실히 나은 벤치 후보를 만든다. 경기 로그는 건드리지 않는다.
 * reviseMatch 는 재생성한 타임라인의 소비 구간이 동일해야 통과하므로, 로그를 직접
 * 수정하면 적용이 거부된다.
 */
function weakenDefense(g) {
  const { plan } = matchPlanAt(g, 1);
  const position = Object.keys(plan.defense).find(
    (pos) =>
      pos !== 'P' &&
      g.roster.some(
        (p) =>
          p.pos !== 'P' &&
          p.squad !== 'reserve' &&
          !plan.lineup.includes(p.id) &&
          familiarity(p, pos) >= 65,
      ),
  );
  assert.ok(position, '벤치 후보가 있는 수비 위치가 필요하다');
  const weak = g.roster.find((p) => p.id === plan.defense[position]);
  weak.field = 15;
  for (const p of g.roster)
    if (p.pos !== 'P' && p.squad !== 'reserve' && !plan.lineup.includes(p.id)) {
      p.field = 95;
      p.condition = 95;
    }
  return { position, weak };
}

/** 7회 이후 우리 수비 상황을 훑어 첫 대수비 제안을 찾는다. 점수 상황은 가리지 않는다. */
function fielderAdvice(g, wantLead) {
  const live = g.liveMatch,
    own = live.home === g.club ? 1 : 0;
  for (let cursor = 1; cursor < live.timeline.log.length; cursor++) {
    const d = matchDecision(live, g.club, cursor);
    if (d.attacking || d.inning < 7) continue;
    const score = live.timeline.log.slice(0, cursor).at(-1)?.play?.after.score || [0, 0];
    const lead = score[own] - score[1 - own];
    if (wantLead === 'lead' && lead <= 0) continue;
    if (wantLead === 'notLead' && lead > 0) continue;
    const suggestion = coachSubstitution(g, cursor);
    if (suggestion?.kind === 'fielder') return { cursor, suggestion, lead };
  }
  return null;
}

test('타격 부진 타자는 기회 상황이 아니어도 대타를 추천한다', () => {
  const g = start(901);
  let found = null;
  for (let cursor = 1; cursor < g.liveMatch.timeline.log.length && !found; cursor++) {
    const d = matchDecision(g.liveMatch, g.club, cursor);
    if (!d.attacking || d.inning < 6 || d.kind === 'opportunity') continue;
    const { plan } = matchPlanAt(g, cursor);
    const batter = g.roster.find((p) => p.id === d.batterId);
    const position = Object.keys(plan.defense).find(
      (pos) => pos !== 'P' && plan.defense[pos] === d.batterId,
    );
    if (!batter || !position) continue;
    const bench = g.roster.filter(
      (p) =>
        p.pos !== 'P' &&
        p.squad !== 'reserve' &&
        !plan.lineup.includes(p.id) &&
        familiarity(p, position) >= 65,
    );
    if (!bench.length) continue;
    // 시즌 타율을 0.240 미만으로 만들고 벤치에 확실히 나은 타자를 둔다.
    Object.assign(batter.stats, { ab: 120, h: 20 });
    batter.contact = 25;
    batter.power = 25;
    for (const p of bench) {
      p.condition = 95;
      p.contact = 95;
      p.power = 90;
    }
    const suggestion = coachSubstitution(g, cursor);
    if (suggestion?.kind === 'batter' && suggestion.outgoing.id === batter.id)
      found = { suggestion, batter };
  }
  assert.ok(found, '기회 상황이 아닌 타석에서도 부진 사유로 추천이 나와야 한다');
  assert.match(found.suggestion.reason, /타율|타격이 맞지/);
});

test('리드 중 후반에는 수비가 약한 야수에 대해 대수비를 추천한다', () => {
  const g = start(902);
  const { position, weak } = weakenDefense(g);
  const found = fielderAdvice(g, 'lead');
  assert.ok(found, '7회 이후 리드 상황에서 대수비 제안을 찾아야 한다');
  const { suggestion } = found;
  assert.equal(suggestion.kind, 'fielder');
  assert.equal(suggestion.outgoing.id, weak.id);
  assert.match(suggestion.reason, /수비/);
  assert.ok(suggestion.incoming.field > weak.field, '수비가 더 좋은 선수를 골라야 한다');
  assert.equal(suggestion.plan.defense[position], suggestion.incoming.id);
  assert.equal(suggestion.plan.lineup.length, 9);
  assert.equal(new Set(suggestion.plan.lineup).size, 9);
  assert.ok(suggestion.plan.lineup.includes(suggestion.incoming.id));
  assert.equal(suggestion.emergency, false);
  assert.equal(suggestion.canWarm, false);
});

test('동점이나 뒤진 상황에서도 대수비를 추천한다', () => {
  const g = start(902);
  weakenDefense(g);
  const found = fielderAdvice(g, 'notLead');
  assert.ok(found, '앞서지 않는 상황에서도 대수비 제안이 나와야 한다');
  assert.ok(found.lead <= 0, `리드가 아닌 상황이어야 한다 (${found.lead})`);
  assert.equal(found.suggestion.kind, 'fielder');
  assert.match(found.suggestion.reason, /동점|뒤지고 있습니다/);
  assert.match(found.suggestion.reason, /추가 실점을 막는/);
});

test('6회 이전에는 대수비를 추천하지 않는다', () => {
  const g = start(902);
  weakenDefense(g);
  const live = g.liveMatch;
  let checked = 0;
  for (let cursor = 1; cursor < live.timeline.log.length; cursor++) {
    const d = matchDecision(live, g.club, cursor);
    if (d.attacking || d.inning >= 7) continue;
    checked++;
    assert.notEqual(
      coachSubstitution(g, cursor)?.kind,
      'fielder',
      `커서 ${cursor} (${d.inning}회) 에서 대수비가 나왔다`,
    );
  }
  assert.ok(checked > 0, '검사한 커서가 있어야 한다');
});

test('대수비 추천 명단은 reviseMatch 서버 검증을 통과한다', () => {
  const g = start(902);
  const { position } = weakenDefense(g);
  const found = fielderAdvice(g);
  assert.ok(found, '대수비 제안을 찾아야 한다');
  const { cursor, suggestion } = found;
  const before = structuredClone(g.liveMatch.timeline.log.slice(0, cursor));
  const next = e.applyAction(g, {
    type: 'reviseMatch',
    ...suggestion.plan,
    cursor,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  assert.deepEqual(next.liveMatch.timeline.log.slice(0, cursor), before);
  assert.equal(matchPlanAt(next, cursor).plan.defense[position], suggestion.incoming.id);
  assert.ok(matchPlanAt(next, cursor).usedBatters.has(suggestion.incoming.id));
});
