import type { AbilityKey, GameState, Player } from './types';
import { gameDate } from './calendar';

export type TrainingFocus = AbilityKey | 'balanced' | 'rest';
export type TrainingPlan = {
  focus: TrainingFocus;
  intensity: 'light' | 'normal' | 'intense';
  restDays: number[];
  mentorId?: string;
  target?: number;
  baseline?: number;
  started: string;
  achieved?: string;
};
export const intensityLabels = { light: '가볍게', normal: '보통', intense: '강하게' };
export const trainingWeek = [
  { day: 1, label: '월' },
  { day: 2, label: '화' },
  { day: 3, label: '수' },
  { day: 4, label: '목' },
  { day: 5, label: '금' },
  { day: 6, label: '토' },
  { day: 0, label: '일' },
];
export function trainingRest(g: GameState, p: Player, day = g.day) {
  const plan = p.trainingPlan;
  return (
    !!plan &&
    (plan.focus === 'rest' ||
      plan.restDays.includes(new Date(gameDate(g, day) + 'T12:00:00Z').getUTCDay()))
  );
}
export function trainingRecovery(g: GameState, p: Player, day = g.day) {
  if (!p.trainingPlan) return 0;
  if (trainingRest(g, p, day)) return 4;
  return p.trainingPlan.intensity === 'intense' ? -3 : p.trainingPlan.intensity === 'light' ? 2 : 0;
}
export function availableMentors(g: GameState, p: Player) {
  return g.roster.filter(
    (m) =>
      m.id !== p.id && m.age >= 26 && m.age >= p.age + 3 && (m.pos === 'P') === (p.pos === 'P'),
  );
}
