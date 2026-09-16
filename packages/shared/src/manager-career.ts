import type { InterviewTurn } from './manager-interview';
import type { GameState } from './types';

export type ManagerContract = {
  club: string;
  salary: number;
  signingBonus?: number;
  targetRank: number;
  signed: string;
  throughYear: number;
  reviewedYear?: number;
  objective?: BoardObjective;
  benefit?: 'funds' | 'training';
  negotiatedYear?: number;
  supportLedger?: { year: number; approved: number; lastApproved: string };
};
export type ManagerOffer = {
  id: string;
  club: string;
  targetRank: number;
  salary: number;
  signingBonus?: number;
  expectation?: ClubExpectation;
  valuation?: {
    currentSalary: number;
    increasePercent: number;
    performance: number;
    reason: string;
  };
  negotiationBudget?: { salary: number; signingBonus: number; total: number; years: number };
  applied: string;
  due: string;
  expires: string;
  closedAt?: string;
  status: 'invited' | 'pending' | 'interview' | 'offered' | 'rejected' | 'expired';
  source?: 'application' | 'approach' | 'renewal';
  public?: boolean;
  priority?: 'win' | 'youth' | 'budget';
  answer?: 'win' | 'youth' | 'budget';
  rivalScore?: number;
  interview?: InterviewTurn[];
  interviewProfile?: import('./manager-interview').InterviewProfile;
  proposal?: string;
  reminderDate?: string;
  budgetAdjustment?: number;
  contractTerms?: {
    status: 'proposal' | 'pending' | 'counter' | 'final' | 'agreed';
    salary: number;
    signingBonus?: number;
    years: number;
    targetRank: number;
    round: number;
    version: number;
    due?: string;
    proposed?: { salary: number; signingBonus?: number; years: number; targetRank: number };
    history: {
      date: string;
      speaker: 'manager' | 'board';
      kind?: 'proposal' | 'acceptance' | 'reply';
      text: string;
      salary: number;
      signingBonus?: number;
      years: number;
      targetRank: number;
    }[];
  };
  message: string;
};
export type ManagerCareer = {
  journey?: import('./manager-journey').ManagerJourney;
  background?: import('./manager-background').ManagerBackground;
  status: 'employed' | 'unemployed';
  contract?: ManagerContract;
  reputation: number;
  earnings: number;
  unemployedSince?: string;
  vacationUntil?: string;
  lastApproach?: string;
  approachHistory?: Record<
    string,
    { closedAt: string; minSalary?: number; minSigningBonus?: number }
  >;
  offers: ManagerOffer[];
  history: {
    club: string;
    from: string;
    to: string;
    reason: 'resigned' | 'sacked';
    endKind?: 'resignation' | 'nonrenewal' | 'dismissal';
    detail?: string;
    targetRank?: number;
    confidence?: number;
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
  | 'trainingCenter'
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
  managerId?: string;
  managerName: string;
  confidence: number;
  baseConfidence: number;
  vacant: boolean;
  reason: string;
  appointed: string;
  startWins: number;
  startLosses: number;
  startDraws?: number;
  vacantSince?: string;
  expectation?: ClubExpectation & { year: number };
  transfers?: {
    year: number;
    appointed: string;
    credit: number;
    acquired: string[];
    events: { id: string; date: string; change: number; reason: string }[];
  };
  board?: {
    year: number;
    appointed: string;
    games: number;
    rank: number;
    leaderGames: number;
    topGames: number;
    credit: number;
    previousConfidence: number;
    change: number;
  };
};
export type ClubExpectation = {
  targetRank: number;
  strengthRank: number;
  previousRank?: number;
  tier: string;
  reason: string;
};
export const finalManagerTerms = (terms: ManagerOffer['contractTerms']) =>
  terms?.status === 'final' || (terms?.status === 'counter' && terms.round >= 3);
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

export function lastManagerProposal(offer: ManagerOffer) {
  const terms = offer.contractTerms;
  return (
    terms?.proposed ||
    [...(terms?.history || [])]
      .reverse()
      .find(
        (entry) =>
          entry.speaker === 'manager' &&
          (entry.kind === 'proposal' || entry.text === '계약 조건을 수정해 제안했습니다.'),
      )
  );
}
