import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const output = join(tmpdir(), 'dugout-preview-substitution-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/web/src/features/matches/preview-substitution';export * from './apps/web/src/features/matches/match-plan-state';export * from './packages/shared/src/management';",
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
  previewSubstitution,
  battingLine,
  matchPlanAt,
  familiarity,
} = createRequire(import.meta.url)(output);

const start = (seed = 811) => {
  const g = e.newGame('kbo-lotte', 'Preview QA', 'full', seed);
  g.day = -22;
  return e.applyAction(g, { type: 'startMatch' });
};

/** Puts the lineup's first eligible fielder into a season-long slump the bench can beat. */
function slump(g) {
  const { plan } = matchPlanAt(g, 0);
  const hitting = g.staff.find((c) => c.role === '타격') || g.staff[0];
  assert.ok(hitting, '타격 코치 또는 대체 코치가 필요하다');
  for (const [slot, id] of plan.lineup.entries()) {
    const outgoing = g.roster.find((p) => p.id === id);
    const position = Object.keys(plan.defense).find(
      (pos) => pos !== 'P' && plan.defense[pos] === id,
    );
    if (!outgoing || !position) continue;
    const bench = g.roster.filter(
      (p) =>
        p.pos !== 'P' &&
        p.squad !== 'reserve' &&
        !plan.lineup.includes(p.id) &&
        familiarity(p, position) >= 65,
    );
    if (!bench.length) continue;
    // 부진 조건: 표본 20타수 이상 + 타율 0.240 미만.
    Object.assign(outgoing.stats, { ab: 120, h: 20 });
    outgoing.condition = 90;
    outgoing.contact = 30;
    outgoing.power = 30;
    for (const p of bench) {
      p.condition = 95;
      p.contact = 90;
      p.power = 85;
      Object.assign(p.stats, { ab: 120, h: 42 });
    }
    return { slot, position, outgoing, bench };
  }
  throw new Error('교체 가능한 후보가 있는 타순을 찾지 못했다');
}

test('경기 전에는 타격 부진 선발에 대해 대타를 추천한다', () => {
  const g = start();
  const { slot, position, outgoing, bench } = slump(g);
  const suggestion = previewSubstitution(g);
  assert.ok(suggestion, '추천이 나와야 한다');
  assert.equal(suggestion.slot, slot);
  assert.equal(suggestion.position, position);
  assert.equal(suggestion.outgoing.id, outgoing.id);
  assert.ok(
    bench.some((p) => p.id === suggestion.incoming.id),
    '벤치 후보 중에서 골라야 한다',
  );
  assert.match(suggestion.reason, /타격|컨디션/);
  assert.equal(suggestion.plan.lineup[slot], suggestion.incoming.id);
  assert.equal(suggestion.plan.defense[position], suggestion.incoming.id);
  assert.equal(suggestion.plan.lineup.length, 9);
  assert.equal(new Set(suggestion.plan.lineup).size, 9);
});

test('타격이 정상인 선발에는 추천하지 않는다', () => {
  const g = start(812);
  const { plan } = matchPlanAt(g, 0);
  for (const id of plan.lineup) {
    const p = g.roster.find((p) => p.id === id);
    Object.assign(p.stats, { ab: 120, h: 45 });
    p.condition = 95;
    p.contact = 95;
    p.power = 90;
  }
  assert.equal(previewSubstitution(g), undefined);
});

test('표본이 20타수 미만이면 타율만으로 부진 판정하지 않는다', () => {
  const g = start(813);
  const { outgoing } = slump(g);
  Object.assign(outgoing.stats, { ab: 8, h: 1 });
  outgoing.condition = 95;
  assert.equal(previewSubstitution(g), undefined);
});

test('경기가 시작된 뒤에는 경기 전 추천을 내지 않는다', () => {
  const g = start(814);
  slump(g);
  assert.ok(previewSubstitution(g), '경기 시작 전에는 추천이 있다');
  g.liveMatch.cursor = 5;
  assert.equal(previewSubstitution(g), undefined);
  g.liveMatch.cursor = 0;
  g.liveMatch.finished = true;
  assert.equal(previewSubstitution(g), undefined);
});

test('추천 명단은 reviseMatch 서버 검증을 통과한다', () => {
  const g = start(815);
  const suggestion = previewSubstitution(g) || (slump(g), previewSubstitution(g));
  assert.ok(suggestion);
  const next = e.applyAction(g, {
    type: 'reviseMatch',
    ...suggestion.plan,
    cursor: 0,
    timelineVersion: g.liveMatch.timelineVersion,
  });
  const applied = matchPlanAt(next, 0);
  assert.equal(applied.plan.lineup[suggestion.slot], suggestion.incoming.id);
});

test('battingLine 은 표본에 따라 타율과 표본 부족을 구분해 표기한다', () => {
  const g = start(816);
  const p = g.roster.find((p) => p.pos !== 'P');
  Object.assign(p.stats, { ab: 100, h: 25 });
  assert.equal(battingLine(p), '100타수 25안타 · 타율 0.250');
  Object.assign(p.stats, { ab: 9, h: 3 });
  assert.match(battingLine(p), /표본 부족/);
});
