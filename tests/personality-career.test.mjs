import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const result = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/recruitment';export * from './apps/api/src/domain/manager-people';export * from './packages/shared/src/manager-directory';export * from './packages/shared/src/coach-directory';export * from './packages/shared/src/personality';",
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
  createRecruitment,
  reconcileManagerPeople,
  availableManager,
  managerDirectory,
  coachDirectory,
  managerCoachingStance,
  playerPersonality,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
function setup() {
  const g = e.newGame('kbo-lotte', '보직 성향 QA', 'short', 777);
  g.budget = 1e6;
  return {
    g,
    p: Object.values(g.managerPeople).find((p) => p.name === '김태형'),
    r: createRecruitment(world),
  };
}
function offer(g, p, r, salary) {
  r.action(g, { type: 'coachOffer', id: p.id, role: '타격', salary, years: 3 });
  const d = g.coachDeals.find((d) => d.coach.id === p.id);
  g.day = d.responseDay;
  r.tick(g);
  return d;
}
test('An unemployed manager accepts a sufficiently paid coaching role and preserves one identity and both careers', () => {
  const { g, p, r } = setup();
  p.personality = { managerPreference: 75, flexibility: 80, money: 90, stubbornness: 60 };
  const d = offer(g, p, r, Math.ceil(managerCoachingStance(p).demand * 1.2));
  assert.equal(d.status, 'accepted');
  assert.ok(!g.staff.some((c) => c.id === p.id));
  const before = g.budget;
  r.action(g, { type: 'signCoach', id: d.id });
  assert.equal(g.staff.find((c) => c.id === p.id).managerPersonId, p.id);
  assert.equal(p.club, g.club);
  assert.equal(p.role, '타격 코치');
  assert.ok(p.career.some((h) => h.role === '감독'));
  assert.ok(p.career.some((h) => h.role === '타격 코치' && h.active));
  assert.equal(managerDirectory(g).filter((x) => x.id === p.id).length, 1);
  assert.equal(
    coachDirectory(g, e.coachPool(g.year)).find((x) => x.coach.id === p.id).club,
    g.club,
  );
  assert.equal(availableManager(g, world, 'kbo-lg')?.id === p.id, false);
  const after = g.budget;
  assert.ok(after < before);
  assert.throws(() => r.action(g, { type: 'signCoach', id: d.id }));
  assert.equal(g.budget, after);
  g.staff = g.staff.filter((c) => c.id !== p.id);
  g.coachAssignments[p.id].club = 'fa';
  reconcileManagerPeople(g, world);
  assert.equal(p.club, undefined);
  assert.ok(p.career.some((h) => h.role === '타격 코치' && !h.active));
});
test('Strong managerial identity refuses even a large coaching salary; flexible managers can counter for more money', () => {
  const hard = setup();
  hard.p.personality = { managerPreference: 95, flexibility: 20, money: 90, stubbornness: 90 };
  const rejected = offer(hard.g, hard.p, hard.r, 99999);
  assert.equal(rejected.status, 'rejected');
  assert.match(rejected.message, /감독직/);
  const soft = setup();
  soft.p.personality = { managerPreference: 60, flexibility: 90, money: 90, stubbornness: 40 };
  const demand = managerCoachingStance(soft.p).demand,
    d = offer(soft.g, soft.p, soft.r, demand * 0.8);
  assert.equal(d.status, 'counter');
  assert.ok(d.salary > demand * 0.8);
  assert.match(d.message, /보수/);
});
test('A manager appointed elsewhere during a coaching negotiation cannot be signed into two roles', () => {
  const { g, p, r } = setup();
  p.personality = { managerPreference: 20, flexibility: 90, money: 40, stubbornness: 20 };
  const d = offer(g, p, r, 9999);
  assert.equal(d.status, 'accepted');
  const job = g.managerJobs['kbo-lg'];
  Object.assign(job, { managerId: p.id, managerName: p.name, vacant: false });
  reconcileManagerPeople(g, world);
  assert.throws(() => r.action(g, { type: 'signCoach', id: d.id }), /다른 보직/);
  assert.ok(!g.staff.some((c) => c.id === p.id));
});
test('Player attachment persists and affects renewal duration and reaction to being offered in a trade', () => {
  const g = e.newGame('kbo-lotte', '선수 성향 QA', 'short', 778),
    p = g.roster.find((p) => !p.real && p.squad === 'reserve');
  p.personality = { loyalty: 95, ambition: 20, money: 20, stubbornness: 90, homeClub: g.club };
  const saved = structuredClone(playerPersonality(p));
  assert.deepEqual(playerPersonality({ ...p, club: 'kbo-lg' }), saved);
  const r = createRecruitment(world);
  r.negotiate(g, p.id, p.salary * 2, 1, 'renew');
  const d = g.deals[0];
  g.day = d.responseDay;
  r.tick(g);
  assert.equal(d.status, 'counter');
  assert.equal(d.years, 3);
  assert.match(d.message, /오래 남고/);
  const before = p.mood.value;
  const listed = e.applyAction(g, { type: 'listPlayer', id: p.id });
  const after = listed.roster.find((x) => x.id === p.id);
  assert.ok(before - after.mood.value > 5);
  assert.match(after.mood.reason, /오래 남고/);
  assert.deepEqual(after.personality, saved);
});
