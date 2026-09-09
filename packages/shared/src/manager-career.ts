import type { GameState } from './types';

export type ManagerContract = {
  club: string;
  salary: number;
  targetRank: number;
  signed: string;
  throughYear: number;
  reviewedYear?: number;
};
export type ManagerOffer = {
  id: string;
  club: string;
  targetRank: number;
  salary: number;
  applied: string;
  due: string;
  expires: string;
  status: 'pending' | 'offered' | 'rejected' | 'expired';
  message: string;
};
export type ManagerCareer = {
  status: 'employed' | 'unemployed';
  contract?: ManagerContract;
  reputation: number;
  earnings: number;
  unemployedSince?: string;
  vacationUntil?: string;
  offers: ManagerOffer[];
  history: {
    club: string;
    from: string;
    to: string;
    reason: 'resigned' | 'sacked';
    rank: number;
  }[];
};
export type ClubCareer = Pick<
  GameState,
  | 'rounds'
  | 'budget'
  | 'income'
  | 'expenses'
  | 'staff'
  | 'lineup'
  | 'starter'
  | 'tactic'
  | 'training'
  | 'defense'
  | 'pitching'
  | 'instructions'
  | 'tacticBook'
  | 'tacticFamiliarity'
  | 'reserve'
  | 'reputation'
  | 'finances'
> & { year: number };
export const isUnemployed = (g: GameState) => g.managerCareer?.status === 'unemployed';

export type ClubManagerJob = {
  club: string;
  managerName: string;
  confidence: number;
  baseConfidence: number;
  vacant: boolean;
  reason: string;
  appointed: string;
  startWins: number;
  startLosses: number;
};
export const MANAGER_APPLICATION_THRESHOLD = 35;
export const managerJobOpen = (job: ClubManagerJob) =>
  job.vacant || job.confidence < MANAGER_APPLICATION_THRESHOLD;
