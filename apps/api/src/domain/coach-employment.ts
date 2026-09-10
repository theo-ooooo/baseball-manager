import type { Coach, GameState } from '@dugout/shared/types';

export function rememberCoaches(g: GameState) {
  g.coachAssignments ??= {};
  for (const coach of g.staff) g.coachAssignments[coach.id] = { club: g.club, coach: { ...coach } };
}

export function releaseCoach(g: GameState, coach: Coach) {
  g.coachAssignments ??= {};
  g.coachAssignments[coach.id] = {
    club: 'fa',
    coach: { ...coach, contractUntil: undefined },
  };
}
