import type { Coach, Player, Pos, Stats } from './types';

export const statKeys = [
  'ab',
  'h',
  'hr',
  'rbi',
  'bb',
  'k',
  'outs',
  'er',
  'wins',
  'g',
  'saves',
  'holds',
  'hrAllowed',
  'sb',
  'cs',
  'sh',
] as const;
export const packStats = (s: Stats) => statKeys.map((key) => s[key] || 0);
export const unpackStats = (s: number[] = []) =>
  Object.fromEntries(statKeys.map((key, i) => [key, s[i] || 0])) as Stats;
export const subtractStats = (a: Stats, b: number[] = []) =>
  unpackStats(packStats(a).map((n, i) => Math.max(0, n - (b[i] || 0))));
export type CareerBaseline = {
  year: number;
  club: string;
  date: string;
  stats: number[];
  reserve: number[];
};
export type PlayerCareerRecord = {
  id: string;
  playerId: string;
  name: string;
  pos: Pos;
  country: string;
  year: number;
  club: string;
  from: string;
  date: string;
  kind: 'season' | 'transfer' | 'retirement';
  stats: Stats;
  reserveStats: Stats;
  awards: string[];
  destination?: string;
  coach?: Coach;
};
/** Compact per-save changes; the immutable runtime player catalog remains in D1. */
export type WorldPlayerState = {
  stats: number[];
  reserve?: number[];
  ratings?: number[];
  salary?: number;
  years?: number;
  age?: number;
  condition?: number;
  stint?: CareerBaseline;
  personality?: Player['personality'];
  remodel?: Player['remodel'];
  observation?: Player['observation'];
  generated?: {
    name: string;
    pos: Pos;
    country: string;
    number: number;
    potential: number;
    born: number;
  };
};
export type WorldEvent = {
  id: string;
  date: string;
  kind: 'appointment' | 'transfer' | 'retirement' | 'youth';
  club: string;
  otherClub?: string;
  playerId?: string;
  text: string;
};
export type WorldSimulation = {
  version: 1;
  revision: number;
  serial: number;
  lastTick?: string;
  archivedYear?: number;
  players: Record<string, WorldPlayerState>;
  retired: string[];
  clubs: Record<
    string,
    { balance: number; strategy: 'contend' | 'develop'; lastTransfer?: string; draftYear?: number }
  >;
  events: WorldEvent[];
};
export type MedicalCase = {
  id: string;
  name: string;
  occurred: string;
  returnDate: string;
  earliestReturn: string;
  severity: 'minor' | 'moderate' | 'major';
  phase: 'treatment' | 'rehab' | 'earlyReturn';
  recurrenceRisk: number;
  rehabilitated?: boolean;
  lastCheck?: string;
};
export const isAvailable = (p: Player) =>
  !p.internationalDuty && (!p.injury || p.injury.phase === 'earlyReturn');
export type TradeRound = {
  round: number;
  date: string;
  outgoing: string[];
  incoming: string[];
  cash: number;
  status: TradeOffer['status'];
  message: string;
  counterOutgoing?: string[];
  counterIncoming?: string[];
  counterCash?: number;
};
export type TradeOffer = {
  round?: number;
  history?: TradeRound[];
  deadline?: { id: string; leading: boolean; reviewed: string; round: number; feedback?: string };
  id: string;
  club: string;
  outgoing: string[];
  incoming: string[];
  cash: number;
  date: string;
  due: string;
  expires: string;
  status: 'pending' | 'accepted' | 'counter' | 'rejected' | 'completed' | 'withdrawn' | 'expired';
  counterCash?: number;
  counterOutgoing?: string[];
  counterIncoming?: string[];
  message: string;
};
export type DraftState = {
  rounds?: number;
  orderYear?: number;
  orderSource?: string;
  year: number;
  league: string;
  mode: 'draft' | 'academy';
  status: 'open' | 'finished';
  round: number;
  order: string[];
  cursor: number;
  prospects: Player[];
  picks: { club: string; playerId: string; name: string; round: number }[];
};
