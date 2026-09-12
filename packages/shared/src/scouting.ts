import type { AbilityKey, Pos } from './types';
import type { SigningOutlook } from './signing-outlook';

export type ScoutReport = {
  playerId: string;
  playerName: string;
  date: string;
  scoutName: string;
  confidence: number;
  overall: [number, number];
  abilities: Partial<Record<AbilityKey, [number, number]>>;
  verdict: string;
  strengths: string[];
  concerns: string[];
  salary: number;
  fee: number;
  /** 우리 구단에 올 가능성. 예전 보고서에는 없다. */
  signing?: SigningOutlook;
};
export type ScoutAssignment = {
  id: string;
  target: { playerId: string } | { league: string; pos: Pos | 'all'; maxAge: number };
  label: string;
  scoutId: string;
  scoutName: string;
  started: string;
  due: string;
  days: number;
  cost: number;
  status: 'active' | 'completed' | 'cancelled';
  // Prepared only on the server; candidate discoveries arrive with the report.
  candidateIds?: string[];
  reportIds?: string[];
};
export type ScoutingState = {
  shortlist: string[];
  assignments: ScoutAssignment[];
  reports: ScoutReport[];
};
export const scoutingDurations = [7, 14, 28] as const;
export const scoutingCost = (days: number, regional: boolean) =>
  Math.round(days * (regional ? 0.6 : 0.3));
