import { hash } from './game-view';

/**
 * 감독의 지도 능력. 평판이 "구단과 언론이 보는 명성" 이라면 이쪽은 실제 운영 역량이다.
 * 평판을 중심으로 항목마다 흩어지므로, 이름값에 비해 경기 운영이 약한 감독도 나온다.
 */
export type ManagerAbility = {
  /** 작전 · 경기 운영 */
  tactics: number;
  /** 투수 교체 · 불펜 운용 */
  bullpen: number;
  /** 선수 육성 */
  development: number;
  /** 선수단 장악 · 동기 부여 */
  motivation: number;
  /** 선수를 보는 눈 · 영입 판단 */
  evaluation: number;
};

export const managerAbilityKeys = [
  'tactics',
  'bullpen',
  'development',
  'motivation',
  'evaluation',
] as const;

export const managerAbilityLabels: Record<keyof ManagerAbility, string> = {
  tactics: '작전 · 경기 운영',
  bullpen: '투수 교체 · 불펜 운용',
  development: '선수 육성',
  motivation: '선수단 장악',
  evaluation: '선수 보는 눈',
};

const rate = (id: string, key: string, reputation: number) =>
  Math.max(
    20,
    Math.min(95, Math.round(reputation + (((hash(`${id}:ability:${key}`) % 41) - 20) * 7) / 10)),
  );

/** 저장본 사이에서 값이 흔들리지 않도록 사람 id 와 평판만으로 결정한다. */
export function managerAbility(person: {
  id: string;
  reputation: number;
  ability?: ManagerAbility;
}): ManagerAbility {
  if (person.ability) return person.ability;
  return {
    tactics: rate(person.id, 'tactics', person.reputation),
    bullpen: rate(person.id, 'bullpen', person.reputation),
    development: rate(person.id, 'development', person.reputation),
    motivation: rate(person.id, 'motivation', person.reputation),
    evaluation: rate(person.id, 'evaluation', person.reputation),
  };
}

/** 한 줄로 보여 줄 종합 수치. 경기 운영에 무게를 둔다. */
export function managerAbilityOverall(ability: ManagerAbility) {
  return (
    Math.round(
      (ability.tactics * 0.26 +
        ability.bullpen * 0.24 +
        ability.development * 0.2 +
        ability.motivation * 0.18 +
        ability.evaluation * 0.12) *
        10,
    ) / 10
  );
}

/**
 * 컴퓨터 구단끼리의 경기에서 전력에 더해지는 값. 선수단 전력이 주인공이어야 하므로
 * 대략 ±1.5 로 묶어, 감독 한 명이 전력 차이를 뒤집지는 못하게 한다.
 */
export function managerStrengthBonus(ability?: ManagerAbility) {
  if (!ability) return 0;
  const operation = ability.tactics * 0.4 + ability.bullpen * 0.35 + ability.motivation * 0.25;
  return Math.max(-1.5, Math.min(1.5, (operation - 55) / 22));
}

const coachRoleAbility: Record<string, keyof ManagerAbility> = {
  타격: 'development',
  투수: 'bullpen',
  수비: 'development',
  체력: 'development',
  스카우트: 'evaluation',
  배터리: 'bullpen',
  수석: 'motivation',
  '주루·작전': 'tactics',
  불펜: 'bullpen',
  재활: 'development',
};

/** 감독이 코치로 전향할 때의 지도력. 보직에 맞는 능력치를 크게 본다. */
export function coachSkillFromAbility(ability: ManagerAbility, role: string) {
  const key = coachRoleAbility[role];
  const primary = key ? ability[key] : managerAbilityOverall(ability);
  return Math.max(
    35,
    Math.min(90, Math.round(primary * 0.6 + managerAbilityOverall(ability) * 0.4)),
  );
}

export function managerAbilityNote(ability: ManagerAbility) {
  const entries = managerAbilityKeys.map((key) => ({ key, value: ability[key] }));
  const best = entries.reduce((a, b) => (b.value > a.value ? b : a));
  const worst = entries.reduce((a, b) => (b.value < a.value ? b : a));
  return best.value - worst.value < 10
    ? `${managerAbilityLabels[best.key]} 을 비롯해 전 항목이 고른 유형입니다.`
    : `${managerAbilityLabels[best.key]} 이 강점이고 ${managerAbilityLabels[worst.key]} 이 약점입니다.`;
}
