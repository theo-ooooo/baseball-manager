import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/manager-career';export * from './apps/api/src/domain/manager-people';export * from './packages/shared/src/manager-directory';export * from './packages/shared/src/calendar';",
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
  managerDirectory,
  createManagerCareer,
  reconcileManagerPeople,
  availableManager,
  addDays,
  gameDate,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
test('Taking Lotte preserves Kim Tae-hyung as a searchable unemployed person, including old saves', () => {
  const g = e.newGame('kbo-lotte', '새 감독', 'short', 615);
  const kim = managerDirectory(g).find((p) => p.name === '김태형');
  assert.ok(kim);
  assert.equal(kim.club, undefined);
  assert.ok(kim.record.career.some((h) => h.club === 'kbo-lotte'));
  const original = kim.id;
  delete g.managerPeople;
  for (const job of Object.values(g.managerJobs)) delete job.managerId;
  createManagerCareer(world).prepare(g);
  assert.equal(managerDirectory(g).find((p) => p.name === '김태형').id, original);
  assert.equal(managerDirectory(g).filter((p) => p.self).length, 1);
});
test('A displaced real manager can be rehired and keeps identity and prior employment', () => {
  const g = e.newGame('kbo-lotte', '새 감독', 'short', 616),
    kim = Object.values(g.managerPeople).find((p) => p.name === '김태형');
  // Bound the eligible pool so this test checks a specific person's lifecycle.
  for (const p of Object.values(g.managerPeople))
    if (p.id !== kim.id && !p.club) p.club = 'test-unavailable';
  const job = g.managerJobs['kbo-lg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  assert.equal(availableManager(g, world, job.club).id, kim.id);
  createManagerCareer(world).tick(g);
  assert.equal(job.managerId, kim.id);
  assert.equal(job.managerName, '김태형');
  assert.equal(g.managerPeople[kim.id].club, 'kbo-lg');
  assert.ok(g.managerPeople[kim.id].career.some((h) => h.club === 'kbo-lotte'));
  assert.ok(g.managerPeople[kim.id].career.some((h) => h.club === 'kbo-lg' && h.active));
  const record = structuredClone(g.managerPeople[kim.id]);
  reconcileManagerPeople(g, world);
  assert.deepEqual(g.managerPeople[kim.id], record);
});
test('Two vacancies cannot appoint the same unemployed person in a single tick', () => {
  const g = e.newGame('kbo-lotte', '새 감독', 'short', 617);
  for (const id of ['kbo-lg', 'kbo-ssg'])
    Object.assign(g.managerJobs[id], { vacant: true, vacantSince: addDays(gameDate(g), -8) });
  createManagerCareer(world).tick(g);
  const employed = Object.values(g.managerJobs)
    .filter((j) => !j.vacant && j.managerId !== 'self')
    .map((j) => j.managerId);
  assert.equal(new Set(employed).size, employed.length);
});

test('Manager identity and recorded wins survive a season change without repeated tick inflation', () => {
  const g = e.newGame('kbo-lotte', '시즌 QA', 'short', 618);
  const job = g.managerJobs['kbo-lg'],
    person = g.managerPeople[job.managerId],
    row = g.standings.kbo.find((r) => r.club === job.club);
  row.w = 10;
  row.l = 5;
  reconcileManagerPeople(g, world);
  const current = person.career.find((h) => h.active);
  assert.equal(current.wins, 10);
  g.year++;
  row.w = 3;
  row.l = 2;
  job.startWins = 0;
  job.startLosses = 0;
  reconcileManagerPeople(g, world);
  assert.equal(current.wins, 13);
  assert.equal(current.losses, 7);
  reconcileManagerPeople(g, world);
  assert.equal(current.wins, 13);
});

test('Every catalog club retains its original manager, including generated incumbents displaced by the user', () => {
  const generatedClub = world.clubs.find((c) => !c.manager);
  assert.ok(generatedClub);
  const g = e.newGame(generatedClub.id, '전체 감독 QA', 'short', 619);
  for (const club of world.clubs)
    assert.ok(
      Object.values(g.managerPeople).some((p) => p.originClub === club.id),
      club.id,
    );
  const former = Object.values(g.managerPeople).find((p) => p.originClub === generatedClub.id);
  assert.equal(former.real, false);
  assert.equal(former.club, undefined);
  assert.ok(managerDirectory(g).some((p) => p.id === former.id));
});
