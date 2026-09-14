import type { ManagerAbility } from './manager-ability';
import type { GameState } from './types';
export type ManagerConnection = {
  id: string;
  name: string;
  kind: 'player' | 'coach';
  origin: 'team' | 'teammate';
  firstMet: string;
  lastMet: string;
  club: string;
  trust: number;
  matches: number;
  trainingDays: number;
  growth: number;
  student?: boolean;
  lastTraining?: string;
  lastReunion?: string;
};
export type ManagerAchievement = {
  id: string;
  title: string;
  date: string;
  club: string;
  detail: string;
  playerId?: string;
};
export type ManagerJourney = {
  version: 1;
  started: string;
  baseAbility: ManagerAbility;
  experience: ManagerAbility;
  ledger: { date: string; totals: ManagerAbility; keys: string[] };
  lastMatch?: { date: string; ids: string[] };
  games: number;
  wins: number;
  connections: ManagerConnection[];
  achievements: ManagerAchievement[];
  recentExperience: { date: string; key: keyof ManagerAbility; amount: number; reason: string }[];
};
export const managerExperienceBonus = (experience: number) =>
  Math.min(12, Math.floor(Math.max(0, experience) / 100));
export const managerExperienceReasons: Record<keyof ManagerAbility, string> = {
  tactics: '완료한 경기와 성공한 사인',
  bullpen: '경기 운영과 무실점 구원 등판',
  development: '23세 이하 선수의 실제 훈련 성장',
  motivation: '직접 마친 인터뷰와 선수단의 긍정 반응',
  evaluation: '완료한 스카우트 관찰 보고',
};
export function managerConnection(g: Pick<GameState, 'managerCareer'>, id: string) {
  return g.managerCareer?.journey?.connections.find((r) => r.id === id);
}
export function coachConnectionDiscount(g: Pick<GameState, 'managerCareer'>, id: string) {
  const relation = managerConnection(g, id);
  return relation?.kind === 'coach' ? Math.min(0.08, Math.max(0, relation.trust - 50) * 0.002) : 0;
}
