import type { Coach, Player } from './types';
import { hash } from './game-view';

export function coachJudgment(coach: Coach) {
  const skill = Math.max(1, Math.min(100, coach.skill));
  return {
    skill,
    label: skill >= 80 ? '정교한 판단' : skill >= 60 ? '숙련된 판단' : '기본 판단',
    // Better coaches spot fatigue earlier and distinguish smaller improvements.
    fatigue: 35 + skill * 0.2,
    minimumGain: 16 - skill * 0.1,
  };
}

/** A stable assessment: refreshes and repeated pauses cannot reroll a coach's opinion. */
export function coachAssessment(coach: Coach, player: Player, pitching: boolean) {
  const skill = coachJudgment(coach).skill;
  const ability = pitching
    ? player.stuff * 0.55 + player.control * 0.45
    : player.contact * 0.6 + player.power * 0.35 + player.speed * 0.05;
  const bias =
    ((hash(`${coach.id}:${player.id}:${pitching}`) % 2001) / 1000 - 1) * (100 - skill) * 0.2;
  return Math.max(1, Math.min(100, ability + bias));
}
