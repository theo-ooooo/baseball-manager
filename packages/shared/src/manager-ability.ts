import { hash } from './game-view';
import { applyManagerTrait } from './manager-traits';
import { managerExperienceBonus } from './manager-journey';
import type { ManagerCareer } from './manager-career';
import type { ManagerBackground } from './manager-background';

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
  background?: ManagerBackground;
}): ManagerAbility {
  const base = person.ability || {
    tactics: rate(person.id, 'tactics', person.reputation),
    bullpen: rate(person.id, 'bullpen', person.reputation),
    development: rate(person.id, 'development', person.reputation),
    motivation: rate(person.id, 'motivation', person.reputation),
    evaluation: rate(person.id, 'evaluation', person.reputation),
  };
  return applyManagerTrait(base, person.background);
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
    ? '능력이 고르게 분포한 균형형 지도자입니다.'
    : `강점: ${managerAbilityLabels[best.key]} · 보완: ${managerAbilityLabels[worst.key]}`;
}

/**
 * 소속 선수의 성장 배율. 육성이 좋은 감독 밑에서 유망주가 더 크고, 노장의 기량
 * 하락도 더디다. 감독이 없거나 능력치를 모르면 1 — 즉 기존 속도 그대로다.
 */
export function managerDevelopmentFactor(ability?: ManagerAbility) {
  if (!ability) return 1;
  return Math.round((0.7 + (ability.development / 100) * 0.6) * 1000) / 1000;
}

/** 기존 시작 능력을 보존하고 평판과 독립된 지도 경험 및 선수 경력 특성을 반영한다. */
export function selfManagerAbility(g: {
  manager: string;
  reputation: number;
  managerCareer?: Pick<ManagerCareer, 'reputation' | 'background' | 'journey'>;
}) {
  const journey = g.managerCareer?.journey;
  const base = journey
    ? (Object.fromEntries(
        managerAbilityKeys.map((key) => [
          key,
          Math.min(95, journey.baseAbility[key] + managerExperienceBonus(journey.experience[key])),
        ]),
      ) as ManagerAbility)
    : managerAbility({
        id: `self:${g.manager}`,
        reputation: g.managerCareer?.reputation ?? g.reputation,
      });
  return applyManagerTrait(base, g.managerCareer?.background);
}

/** 경기 시작 때 고정한 능력에만 적용한다. 55가 기준이며 선수 기량을 소폭 보조한다. */
export function managerMatchEffects(ability?: ManagerAbility) {
  const offset = (key: keyof ManagerAbility) =>
    ability ? Math.max(-35, Math.min(40, ability[key] - 55)) : 0;
  return {
    contact: offset('tactics') * 0.0002 + offset('motivation') * 0.00005,
    pitching: offset('bullpen') * 0.045 + offset('motivation') * 0.005,
    control: offset('bullpen') * 0.06,
    defense: offset('tactics') * 0.03,
    execution: offset('tactics') * 0.3,
    fatigueThreshold: 40 + offset('bullpen') * 0.125,
  };
}

export const managerAbilityEffects: Record<keyof ManagerAbility, string> = {
  tactics: '타석 운영과 수비 조직력, 번트·도루 수행을 돕습니다.',
  bullpen: '투구·제구를 보조하고 자동 교체 시 피로 판단에 반영됩니다.',
  development: '훈련 성장률과 노장 선수의 기량 유지에 반영됩니다.',
  motivation: '경기 집중력과 직접 전하는 라커룸 메시지의 반응에 반영됩니다.',
  evaluation: '스카우트 보고의 정확도를 보조합니다. AI 감독은 채용·코치 전향 평가에도 반영됩니다.',
};
