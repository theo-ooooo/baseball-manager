import type { GameState, WorldCatalog } from '@dugout/shared/types';
import type { ManagerRecord } from '@dugout/shared/manager-directory';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { hash, rng, teamBudget, coachRoles } from '@dugout/shared/game-view';
import { managerPersonality } from '@dugout/shared/personality';
import {
  managerAbility,
  managerAbilityOverall,
  coachSkillFromAbility,
} from '@dugout/shared/manager-ability';
import { createPlayerGenerator } from './player-generator';
const reputation = (level: number) => Math.max(25, Math.min(95, level - 10));
export function reconcileManagerPeople(g: GameState, world: WorldCatalog) {
  const people = (g.managerPeople ??= {}),
    today = gameDate(g);
  const generator = createPlayerGenerator(world);
  for (const club of world.clubs) {
    const league = world.leagues.find((l) => l.id === club.league)!;
    const name =
      club.manager?.name ||
      `${generator.generatedName(league.country, rng(hash(club.id + 'initial')))} (가상)`;
    let id = `manager-${club.manager ? 'real' : 'initial'}-${club.id}-${hash(name)}`;
    const prior = Object.values(people).find(
      (p) =>
        p.originClub === club.id &&
        p.name === name &&
        p.id !== id &&
        g.managerJobs?.[club.id]?.managerId === p.id,
    );
    if (
      prior &&
      !people[id]?.club &&
      !g.coachAssignments?.[id] &&
      !g.coachDeals?.some((d) => d.coach.id === id)
    ) {
      if (people[id]) {
        prior.aliases = [...new Set([...(prior.aliases || []), id])];
        delete people[id];
      }
      id = prior.id;
    }
    people[id] ??= {
      id,
      name,
      real: !!club.manager,
      originClub: club.id,
      reputation: reputation(league.level),
      source: club.manager?.source,
      career: [],
    };
  }
  const active = new Map<string, NonNullable<GameState['managerJobs']>[string]>();
  for (const job of Object.values(g.managerJobs || {})) {
    if (g.managerCareer?.status === 'employed' && job.club === g.club) {
      job.managerId = 'self';
      continue;
    }
    if (job.vacant || job.managerName === '공석') continue;
    let person = job.managerId ? people[job.managerId] : undefined;
    if (person?.name !== job.managerName || active.has(person.id))
      person =
        Object.values(people).find(
          (person) =>
            person.name === job.managerName &&
            person.originClub === job.club &&
            !active.has(person.id),
        ) ||
        Object.values(people).find(
          (person) => person.name === job.managerName && !person.club && !active.has(person.id),
        );
    if (!person) {
      const id = `manager-generated-${hash(`${job.managerName}:${job.appointed}:${job.club}`)}`;
      const club = world.clubs.find((c) => c.id === job.club)!;
      person = people[id] = {
        id,
        name: job.managerName,
        real: false,
        originClub: job.club,
        reputation: reputation(world.leagues.find((l) => l.id === club.league)!.level),
        career: [],
      };
    }
    job.managerId = person.id;
    active.set(person.id, job);
  }
  for (const person of Object.values(people)) {
    person.personality ??= managerPersonality(person.id);
    person.ability ??= managerAbility(person);
    const league = world.clubs.find((c) => c.id === person.originClub)?.league || 'kbo';
    const role = coachRoles[hash(person.id) % coachRoles.length];
    person.coach ??= {
      id: person.id,
      managerPersonId: person.id,
      name: person.name,
      real: person.real,
      role,
      // 보직에 맞는 지도 능력을 따른다. 평판만 보면 이름값 높은 감독이 전 보직에서
      // 유능한 코치가 되어 버린다.
      skill: coachSkillFromAbility(person.ability, role),
      salary: Math.max(1, Math.round(teamBudget(league) * 0.004 * (person.reputation / 60))),
      style: '선수단 운영 경험',
      source: person.source,
      verifiedRole: '감독 경력 · 게임 내 코치 보직 전환',
    };
  }
  for (const person of Object.values(people)) {
    const job = active.get(person.id);
    const staff = g.staff.find((c) => c.managerPersonId === person.id);
    const assignment = staff ? { club: g.club, coach: staff } : g.coachAssignments?.[person.id];
    const coaching =
      !job &&
      assignment &&
      assignment.club !== 'fa' &&
      (assignment.coach.contractUntil || 0) > g.year
        ? assignment
        : undefined;
    const role = job ? '감독' : coaching ? `${coaching.coach.role} 코치` : undefined;
    const currentClub = job?.club || coaching?.club;
    const previous = person.career.find((entry) => entry.active);
    if (
      previous &&
      (!currentClub ||
        previous.club !== currentClub ||
        (previous.role || '감독') !== role ||
        (job && previous.from !== job.appointed))
    ) {
      previous.active = false;
      previous.to = today;
      previous.reason =
        previous.role && previous.role !== '감독'
          ? '코치 보직 종료 · 다른 코치직 또는 감독직 검토 가능'
          : g.managerJobs?.[previous.club]?.vacant
            ? g.managerJobs[previous.club].reason
            : '새 감독 취임으로 감독직 인계';
    }
    if (job) {
      person.club = job.club;
      person.role = '감독';
      person.confidence = job.confidence;
      delete person.idleSince;
      let current = person.career.find((entry) => entry.active);
      if (!current) {
        current = { club: job.club, from: job.appointed, active: true, wins: 0, losses: 0 };
        person.career.unshift(current);
        person.career = person.career.slice(0, 20);
      }
      const club = world.clubs.find((c) => c.id === job.club)!;
      const row = g.standings[club.league]?.find((r) => r.club === job.club);
      const wins = Math.max(0, (row?.w || 0) - job.startWins),
        losses = Math.max(0, (row?.l || 0) - job.startLosses);
      // Store only newly observed results so a new season cannot erase a person's record.
      const sameYear = current.lastYear === g.year;
      current.wins =
        (current.wins || 0) + Math.max(0, wins - (sameYear ? current.lastWins || 0 : 0));
      current.losses =
        (current.losses || 0) + Math.max(0, losses - (sameYear ? current.lastLosses || 0 : 0));
      current.lastYear = g.year;
      current.lastWins = wins;
      current.lastLosses = losses;
    } else if (coaching) {
      person.club = coaching.club;
      person.role = role;
      delete person.confidence;
      delete person.idleSince;
      if (!person.career.some((entry) => entry.active))
        person.career.unshift({ club: coaching.club, from: today, active: true, role });
    } else {
      delete person.role;
      delete person.club;
      delete person.confidence;
      person.idleSince ??= today;
      // Catalog identity survives a replaced or missing legacy job; unknown historical dates stay unknown.
      if (!person.career.length && person.originClub)
        person.career.push({
          club: person.originClub,
          active: false,
          reason: '구단 전임 감독 · 이전 재임 날짜 기록 없음',
          role: '감독',
        });
    }
  }
}
/**
 * Days the person has held no job. Reads `idleSince` rather than career dates because catalog
 * incumbents displaced at game start carry an undated departure entry.
 */
export function idleDays(g: GameState, person: ManagerRecord) {
  return person.idleSince ? Math.max(0, daysBetween(person.idleSince, gameDate(g))) : 0;
}

export function idleManagers(g: GameState) {
  return Object.values(g.managerPeople || {}).filter(
    (person) =>
      !person.club &&
      !Object.values(g.managerJobs || {}).some((job) => !job.vacant && job.managerId === person.id),
  );
}

/**
 * Managers who go unhired for a long stretch take a coaching job instead of waiting forever.
 * `reconcileManagerPeople` already reads `coachAssignments`, so recording one here is enough to
 * show the person as a coach. A reserve of idle managers stays untouched so real people, not
 * freshly generated names, keep filling vacancies.
 */
export function convertIdleManagersToCoaches(g: GameState, world: WorldCatalog) {
  const idle = idleManagers(g);
  const reserve = Math.max(4, Math.round(world.clubs.length * 0.05));
  if (idle.length <= reserve) return [];
  const assignments = (g.coachAssignments ??= {});
  const perClub = new Map<string, number>();
  for (const assignment of Object.values(assignments))
    if (assignment.club !== 'fa')
      perClub.set(assignment.club, (perClub.get(assignment.club) || 0) + 1);
  const today = gameDate(g);
  const converted: { person: ManagerRecord; club: string }[] = [];
  const candidates = idle
    .filter(
      (person) =>
        !!person.coach &&
        idleDays(g, person) >= 150 &&
        !assignments[person.id] &&
        !g.coachDeals?.some((deal) => deal.coach.id === person.id) &&
        !g.staff.some((coach) => coach.managerPersonId === person.id),
    )
    .sort((a, b) => idleDays(g, b) - idleDays(g, a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, idle.length - reserve));
  for (const person of candidates) {
    const league = world.clubs.find((c) => c.id === person.originClub)?.league;
    const club = world.clubs
      .filter((c) => c.id !== g.club)
      .sort(
        (a, b) =>
          (perClub.get(a.id) || 0) - (perClub.get(b.id) || 0) ||
          Number(b.league === league) - Number(a.league === league) ||
          hash(`${person.id}:${a.id}`) - hash(`${person.id}:${b.id}`),
      )[0];
    if (!club) break;
    assignments[person.id] = {
      club: club.id,
      coach: { ...person.coach!, contractUntil: g.year + 2 },
    };
    perClub.set(club.id, (perClub.get(club.id) || 0) + 1);
    person.career.unshift({
      club: club.id,
      from: today,
      active: true,
      role: `${person.coach!.role} 코치`,
    });
    person.career = person.career.slice(0, 20);
    converted.push({ person, club: club.id });
  }
  return converted;
}

export function availableManager(
  g: GameState,
  world: WorldCatalog,
  clubId: string,
): ManagerRecord | undefined {
  const club = world.clubs.find((c) => c.id === clubId)!;
  const level = world.leagues.find((l) => l.id === club.league)!.level;
  return idleManagers(g)
    .filter(
      (person) =>
        !person.career.some(
          (entry) => entry.club === clubId && !!entry.to && daysBetween(entry.to, gameDate(g)) < 30,
        ),
    )
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
  // A club hires the manager whose standing fits its league, not whoever is simply the most
  // renowned. Ranking by reputation alone sent one person to every vacancy and left everyone
  // else idle forever, so distance from the league level and idle time both count.
  function score(person: ManagerRecord) {
    const sameLeague =
      world.clubs.find((c) => c.id === person.originClub)?.league === club.league ? 12 : 0;
    const fit = 30 - Math.abs(person.reputation - reputation(level));
    // 평판이 비슷한 후보 사이에서는 실제 지도 능력을 본다. 평판 적합도를 뒤집지 않도록
    // 폭을 좁게 둔다.
    const ability = (managerAbilityOverall(managerAbility(person)) - 55) / 6;
    return fit + sameLeague + ability + Math.min(20, Math.floor(idleDays(g, person) / 14) * 4);
  }
}
