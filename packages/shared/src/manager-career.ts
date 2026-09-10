import type { InterviewTurn } from './manager-interview';
import type { GameState } from './types';

export type ManagerContract = {
  club: string;
  salary: number;
  targetRank: number;
  signed: string;
  throughYear: number;
  reviewedYear?: number;
  objective?: BoardObjective;
  benefit?: 'funds' | 'training';
  negotiatedYear?: number;
};
export type ManagerOffer = {
  id: string;
  club: string;
  targetRank: number;
  salary: number;
  applied: string;
  due: string;
  expires: string;
  status: 'invited' | 'pending' | 'interview' | 'offered' | 'rejected' | 'expired';
  source?: 'application' | 'approach';
  public?: boolean;
  priority?: 'win' | 'youth' | 'budget';
  answer?: 'win' | 'youth' | 'budget';
  rivalScore?: number;
  interview?: InterviewTurn[];
  proposal?: string;
  reminderDate?: string;
  budgetAdjustment?: number;
  contractTerms?: {
    status: 'proposal' | 'pending' | 'counter' | 'agreed';
    salary: number;
    years: number;
    targetRank: number;
    round: number;
    version: number;
    due?: string;
    proposed?: { salary: number; years: number; targetRank: number };
    history: {
      date: string;
      speaker: 'manager' | 'board';
      text: string;
      salary: number;
      years: number;
      targetRank: number;
    }[];
  };
  message: string;
};
export type ManagerCareer = {
  status: 'employed' | 'unemployed';
  contract?: ManagerContract;
  reputation: number;
  earnings: number;
  unemployedSince?: string;
  vacationUntil?: string;
  lastApproach?: string;
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
  | 'facilities'
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
  vacantSince?: string;
};
export const MANAGER_APPLICATION_THRESHOLD = 35;
export const managerJobOpen = (job: ClubManagerJob) =>
  job.vacant || job.confidence < MANAGER_APPLICATION_THRESHOLD;

export type BoardObjective = {
  kind: 'youth' | 'wages' | 'profit';
  target: number;
  year: number;
  baseline: { wages: number; profit: number; appearances: number; youth: number };
  recordedAppearances?: { total: number; youth: number };
};
export const boardObjectiveLabels = {
  youth: '23세 이하 출전 비중',
  wages: '선수 연봉 절감',
  profit: '구단 운영 흑자',
};
export function boardProgress(g: GameState, objective: BoardObjective) {
  const wages = g.roster.reduce((sum, p) => sum + p.salary, 0);
  if (objective.kind === 'wages') return (1 - wages / Math.max(1, objective.baseline.wages)) * 100;
  if (objective.kind === 'profit') return g.income - g.expenses - objective.baseline.profit;
  if (objective.recordedAppearances)
    return objective.recordedAppearances.total > 0
      ? (objective.recordedAppearances.youth / objective.recordedAppearances.total) * 100
      : 0;
  const games = g.roster.reduce((sum, p) => sum + p.stats.g, 0) - objective.baseline.appearances;
  const youth =
    g.roster.filter((p) => p.age <= 23).reduce((sum, p) => sum + p.stats.g, 0) -
    objective.baseline.youth;
  return games > 0 ? (Math.max(0, youth) / games) * 100 : 0;
}
