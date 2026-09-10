import type { Coach, GameState } from './types';

export function coachEmployer(g: GameState, coach: Coach) {
  if (g.staff.some((c) => c.id === coach.id)) return g.club;
  const assignment = g.coachAssignments?.[coach.id];
  if (assignment) {
    if (assignment.coach.contractUntil !== undefined && assignment.coach.contractUntil <= g.year)
      return 'fa';
    return assignment.club;
  }
  return coach.sourceClub || 'fa';
}

export function coachDirectory(g: GameState, catalog: Coach[]) {
  const coaches = new Map(catalog.map((c) => [c.id, c]));
  for (const { coach } of Object.values(g.coachAssignments || {})) coaches.set(coach.id, coach);
  for (const coach of g.staff) coaches.set(coach.id, coach);
  return [...coaches.values()].map((coach) => ({
    coach,
    club: coachEmployer(g, coach),
    assigned: g.staff.some((c) => c.id === coach.id),
  }));
}
