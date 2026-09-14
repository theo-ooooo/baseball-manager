import type { GameState, Coach } from './types';
import type { ClubManagerJob } from './manager-career';
import type { ManagerAbility } from './manager-ability';
export type ManagerRecord = {
  background?: import('./manager-background').ManagerBackground;
  id: string;
  aliases?: string[];
  name: string;
  real: boolean;
  reputation: number;
  originClub?: string;
  club?: string;
  source?: string;
  confidence?: number;
  role?: string;
  /** Set while the person holds no job, so idle time survives saves with undated departures. */
  idleSince?: string;
  coach?: Coach;
  /** 지도 능력. 예전 저장본에는 없으므로 `managerAbility` 로 채워 읽는다. */
  ability?: ManagerAbility;
  personality?: import('./personality').ManagerPersonality;
  career: {
    club: string;
    from?: string;
    to?: string;
    active: boolean;
    role?: string;
    wins?: number;
    losses?: number;
    reason?: string;
    lastYear?: number;
    lastWins?: number;
    lastLosses?: number;
  }[];
};
export type ManagerPerson = {
  id: string;
  name: string;
  club?: string;
  formerClub?: string;
  self: boolean;
  job?: ClubManagerJob;
  record?: ManagerRecord;
};
export const managerPersonId = (job: ClubManagerJob) =>
  job.managerId || `${job.club}:${job.appointed}:${job.managerName}`;
export const managerPersonPath = (id: string) => `/managers/${encodeURIComponent(id)}`;
/** Appointment identity prevents an old person's URL from silently becoming a replacement manager. */
export function managerDirectory(g: GameState): ManagerPerson[] {
  const employed = g.managerCareer?.status !== 'unemployed';
  return [
    {
      id: 'self',
      name: g.manager,
      club: employed ? g.club : undefined,
      self: true,
      job: employed ? g.managerJobs?.[g.club] : undefined,
    },
    ...(g.managerPeople
      ? Object.values(g.managerPeople).map((record) => ({
          id: record.id,
          name: record.name,
          club: record.club,
          formerClub: record.club ? undefined : record.originClub,
          self: false,
          record,
          job: Object.values(g.managerJobs || {}).find(
            (job) => !job.vacant && job.managerId === record.id,
          ),
        }))
      : Object.values(g.managerJobs || {})
          .filter((job) => !(job.club === g.club && job.managerName === g.manager))
          .map((job) => ({
            id: managerPersonId(job),
            name: job.managerName,
            club: job.vacant ? undefined : job.club,
            formerClub: job.vacant ? job.club : undefined,
            self: false,
            job,
          }))),
  ];
}
