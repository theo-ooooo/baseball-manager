import type { GameState, WorldCatalog } from '@dugout/shared/types';
import type { ManagerRecord } from '@dugout/shared/manager-directory';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { hash, rng, teamBudget, coachRoles } from '@dugout/shared/game-view';
import { managerPersonality } from '@dugout/shared/personality';
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
    const league = world.clubs.find((c) => c.id === person.originClub)?.league || 'kbo';
    person.coach ??= {
      id: person.id,
      managerPersonId: person.id,
      name: person.name,
      real: person.real,
      role: coachRoles[hash(person.id) % coachRoles.length],
      skill: Math.max(35, Math.min(90, person.reputation)),
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
      if (!person.career.some((entry) => entry.active))
        person.career.unshift({ club: coaching.club, from: today, active: true, role });
    } else {
      delete person.role;
      delete person.club;
      delete person.confidence;
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
export function availableManager(
  g: GameState,
  world: WorldCatalog,
  clubId: string,
): ManagerRecord | undefined {
  const club = world.clubs.find((c) => c.id === clubId)!;
  return Object.values(g.managerPeople || {})
    .filter(
      (person) =>
        !person.club &&
        !Object.values(g.managerJobs || {}).some(
          (job) => !job.vacant && job.managerId === person.id,
        ) &&
        !person.career.some(
          (entry) => entry.club === clubId && !!entry.to && daysBetween(entry.to, gameDate(g)) < 30,
        ),
    )
    .sort((a, b) => {
      const sameLeague = (person: ManagerRecord) =>
        world.clubs.find((c) => c.id === person.originClub)?.league === club.league ? 20 : 0;
      return (
        b.reputation + sameLeague(b) - (a.reputation + sameLeague(a)) || a.id.localeCompare(b.id)
      );
    })[0];
}
