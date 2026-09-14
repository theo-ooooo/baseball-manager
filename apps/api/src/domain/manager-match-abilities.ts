import type { GameState } from '@dugout/shared/types';
import { managerAbility, selfManagerAbility } from '@dugout/shared/manager-ability';

export function clubManagerAbility(g: GameState, club: string) {
  if (club === g.club && g.managerCareer?.status !== 'unemployed') return selfManagerAbility(g);
  const job = g.managerJobs?.[club];
  const person = job && !job.vacant && job.managerId ? g.managerPeople?.[job.managerId] : undefined;
  return person ? managerAbility(person) : undefined;
}

export function snapshotMatchManagers(g: GameState, home: string, away: string) {
  return structuredClone({
    version: 1 as const,
    home: clubManagerAbility(g, home),
    away: clubManagerAbility(g, away),
  });
}
