import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/manager-career';export * from './apps/api/src/domain/manager-people';export * from './packages/shared/src/manager-directory';export * from './packages/shared/src/calendar';export * from './packages/shared/src/manager-ability';",
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
  convertIdleManagersToCoaches,
  idleDays,
  addDays,
  gameDate,
  managerAbility,
  managerAbilityOverall,
  managerStrengthBonus,
  coachSkillFromAbility,
  managerAbilityKeys,
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

/** 무직 감독 풀을 원하는 규모로 만든다. reconcile 이 coach 프로필과 idleSince 를 채운다. */
function seedIdleManagers(g, count, idleSince) {
  for (let n = 0; n < count; n++) {
    const id = `manager-test-idle-${n}`;
    g.managerPeople[id] = {
      id,
      name: `무직감독${n}`,
      real: false,
      originClub: 'kbo-lg',
      reputation: 40 + n,
      career: [],
    };
  }
  reconcileManagerPeople(g, world);
  for (const person of Object.values(g.managerPeople))
    if (person.id.startsWith('manager-test-idle-') && idleSince) person.idleSince = idleSince;
  return Object.values(g.managerPeople).filter((p) => p.id.startsWith('manager-test-idle-'));
}

test('감독 공석은 리그 수준에 맞는 인물을 뽑고, 오래 쉰 인물을 우선 고려한다', () => {
  const g = e.newGame('kbo-lotte', '리그 적합 QA', 'short', 621);
  const job = g.managerJobs['kbo-ssg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  const level = world.leagues.find(
    (l) => l.id === world.clubs.find((c) => c.id === job.club).league,
  ).level;
  const [renowned, fitting] = seedIdleManagers(g, 2, gameDate(g));
  for (const p of Object.values(g.managerPeople))
    if (!p.club && p !== renowned && p !== fitting) p.club = 'test-unavailable';
  // 리그 수준에서 크게 벗어난 최고 평판자보다 수준이 맞는 인물이 선임된다.
  renowned.reputation = 99;
  fitting.reputation = Math.max(25, level - 10);
  assert.equal(availableManager(g, world, job.club).id, fitting.id);
  // 평판이 같으면 더 오래 쉰 인물이 앞선다.
  renowned.reputation = fitting.reputation;
  renowned.idleSince = addDays(gameDate(g), -120);
  assert.ok(idleDays(g, renowned) > idleDays(g, fitting));
  assert.equal(availableManager(g, world, job.club).id, renowned.id);
});

test('장기 무직 감독은 코치로 전향하고 감독 후보에서 빠진다', () => {
  const g = e.newGame('kbo-lotte', '코치 전향 QA', 'short', 622);
  seedIdleManagers(g, 10, addDays(gameDate(g), -200));
  const converted = convertIdleManagersToCoaches(g, world);
  assert.ok(converted.length > 0, '전향 인원이 있어야 한다');
  const { person, club } = converted[0];
  assert.notEqual(club, g.club, '플레이어 구단에는 배정하지 않는다');
  assert.equal(g.coachAssignments[person.id].club, club);
  assert.ok(g.coachAssignments[person.id].coach.contractUntil > g.year);
  reconcileManagerPeople(g, world);
  assert.ok(person.role.endsWith('코치'), `보직 ${person.role}`);
  assert.equal(person.club, club);
  assert.equal(person.idleSince, undefined);
  const job = g.managerJobs['kbo-ssg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  assert.notEqual(availableManager(g, world, job.club)?.id, person.id);
});

test('코치 전향은 예비 인력을 남겨 감독 공석을 실제 인물로 채운다', () => {
  const g = e.newGame('kbo-lotte', '예비 인력 QA', 'short', 623);
  seedIdleManagers(g, 12, addDays(gameDate(g), -400));
  convertIdleManagersToCoaches(g, world);
  reconcileManagerPeople(g, world);
  const remaining = Object.values(g.managerPeople).filter((p) => !p.club);
  assert.ok(remaining.length >= 7, `남은 무직 인물 ${remaining.length}`);
  const job = g.managerJobs['kbo-ssg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  createManagerCareer(world).tick(g);
  assert.equal(job.vacant, false);
  assert.ok(job.managerId, '가상 감독이 아니라 기존 인물이 선임되어야 한다');
});

test('짧은 무직 기간에는 코치로 전향하지 않는다', () => {
  const g = e.newGame('kbo-lotte', '전향 대기 QA', 'short', 625);
  seedIdleManagers(g, 12, addDays(gameDate(g), -10));
  assert.deepEqual(convertIdleManagersToCoaches(g, world), []);
});

test('무직 기간은 idleSince 로 누적되고 재취업하면 초기화된다', () => {
  const g = e.newGame('kbo-lotte', '무직 기간 QA', 'short', 624);
  const person = Object.values(g.managerPeople).find((p) => !p.club);
  assert.ok(person.idleSince, '무직 인물은 idleSince 가 기록된다');
  assert.equal(idleDays(g, person), 0);
  person.idleSince = addDays(gameDate(g), -30);
  assert.equal(idleDays(g, person), 30);
  for (const p of Object.values(g.managerPeople))
    if (p !== person && !p.club) p.club = 'test-unavailable';
  const job = g.managerJobs['kbo-ssg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  createManagerCareer(world).tick(g);
  assert.equal(job.managerId, person.id);
  assert.equal(person.idleSince, undefined);
});

test('감독마다 지도 능력이 정해지고 저장본을 오가도 값이 유지된다', () => {
  const g = e.newGame('kbo-lotte', '새 감독', 'short', 731);
  const people = Object.values(g.managerPeople);
  assert.ok(people.length > 10);
  for (const person of people) {
    assert.ok(person.ability, `${person.name} 능력치 없음`);
    for (const key of managerAbilityKeys) {
      const value = person.ability[key];
      assert.ok(value >= 20 && value <= 95, `${key}=${value}`);
    }
  }
  // 항목마다 흩어져야 한다. 전원이 평판 그대로면 능력치를 둔 의미가 없다.
  const spread = people.map(
    (p) =>
      Math.max(...managerAbilityKeys.map((k) => p.ability[k])) -
      Math.min(...managerAbilityKeys.map((k) => p.ability[k])),
  );
  assert.ok(spread.filter((n) => n > 0).length > people.length * 0.8, `편차 ${spread.slice(0, 5)}`);

  const person = people[0];
  const saved = JSON.parse(JSON.stringify(person.ability));
  // 예전 저장본(능력치 없음)에서도 같은 값으로 복원되어야 한다.
  delete person.ability;
  assert.deepEqual(managerAbility(person), saved);
  reconcileManagerPeople(g, world);
  assert.deepEqual(g.managerPeople[person.id].ability, saved);
});

test('컴퓨터 구단 경기 전력 보정은 감독 역량을 따르되 좁은 폭에 묶인다', () => {
  const strong = managerStrengthBonus({
    tactics: 95,
    bullpen: 95,
    development: 95,
    motivation: 95,
    evaluation: 95,
  });
  const weak = managerStrengthBonus({
    tactics: 20,
    bullpen: 20,
    development: 20,
    motivation: 20,
    evaluation: 20,
  });
  assert.ok(strong > weak);
  assert.ok(strong <= 1.5 && weak >= -1.5, `${strong} / ${weak}`);
  assert.equal(managerStrengthBonus(undefined), 0, '감독 기록이 없으면 보정이 없어야 한다');
});

test('코치로 전향하면 보직에 맞는 지도 능력을 지도력으로 삼는다', () => {
  const teacher = { tactics: 30, bullpen: 30, development: 90, motivation: 30, evaluation: 30 };
  const pitching = { tactics: 30, bullpen: 90, development: 30, motivation: 30, evaluation: 30 };
  assert.ok(coachSkillFromAbility(teacher, '타격') > coachSkillFromAbility(pitching, '타격'));
  assert.ok(coachSkillFromAbility(pitching, '투수') > coachSkillFromAbility(teacher, '투수'));
  for (const role of ['타격', '투수', '수석', '스카우트', '주루·작전']) {
    const skill = coachSkillFromAbility(teacher, role);
    assert.ok(skill >= 35 && skill <= 90, `${role}=${skill}`);
  }

  const g = e.newGame('kbo-lotte', '새 감독', 'short', 732);
  for (const person of Object.values(g.managerPeople))
    assert.equal(
      person.coach.skill,
      coachSkillFromAbility(person.ability, person.coach.role),
      person.name,
    );
});

test('평판이 비슷하면 지도 능력이 나은 감독이 먼저 채용된다', () => {
  const g = e.newGame('kbo-lotte', '새 감독', 'short', 733);
  const job = g.managerJobs['kbo-lg'];
  job.vacant = true;
  job.vacantSince = addDays(gameDate(g), -8);
  const [a, b] = seedIdleManagers(g, 2, addDays(gameDate(g), -30));
  // 평판·연고·무직 기간을 같게 맞추고 능력치만 다르게 둔다.
  for (const person of Object.values(g.managerPeople))
    if (!person.club && person !== a && person !== b) person.club = 'test-unavailable';
  for (const person of [a, b]) {
    person.reputation = 60;
    person.originClub = 'kbo-lg';
    person.career = [];
  }
  const better = { tactics: 90, bullpen: 90, development: 90, motivation: 90, evaluation: 90 };
  const worse = { tactics: 25, bullpen: 25, development: 25, motivation: 25, evaluation: 25 };
  a.ability = worse;
  b.ability = better;
  assert.ok(managerAbilityOverall(better) > managerAbilityOverall(worse));
  assert.equal(availableManager(g, world, 'kbo-lg').id, b.id);
  a.ability = better;
  b.ability = worse;
  assert.equal(availableManager(g, world, 'kbo-lg').id, a.id);
});
