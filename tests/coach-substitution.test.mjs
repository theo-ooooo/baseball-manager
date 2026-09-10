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
      "export * from './tests/fixtures/engine';export * from './apps/web/src/features/matches/coach-substitution';export * from './apps/web/src/features/matches/match-plan-state';export * from './packages/shared/src/coach-assessment';export * from './packages/shared/src/coach-directory';export * from './packages/shared/src/match-energy';export * from './packages/shared/src/match-decision';",
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
