import type { Player } from './types';
import { hash } from './game-view';
export type ManagerPersonality = {
  managerPreference: number;
  flexibility: number;
  money: number;
  stubbornness: number;
};
export type PlayerPersonality = {
  loyalty: number;
  ambition: number;
  money: number;
  stubbornness: number;
  homeClub?: string;
};
const trait = (id: string, key: string) => 20 + (hash(`${id}:personality:${key}`) % 76);
/** Fictional game tendencies, stable across employment and save reloads. */
export function managerPersonality(id: string): ManagerPersonality {
  return {
    managerPreference: trait(id, 'manager'),
    flexibility: trait(id, 'flexible'),
    money: trait(id, 'money'),
    stubbornness: trait(id, 'stubborn'),
  };
}
export function playerPersonality(p: Player): PlayerPersonality {
  return (
    p.personality || {
      loyalty: trait(p.id, 'loyal'),
      ambition: trait(p.id, 'ambition'),
      money: trait(p.id, 'money'),
      stubbornness: trait(p.id, 'stubborn'),
      homeClub: p.club === 'fa' ? undefined : p.club,
    }
  );
}
export function managerCoachingStance(p: {
  personality?: ManagerPersonality;
  id: string;
  coach?: { salary: number };
}) {
  const t = p.personality || managerPersonality(p.id);
  const refuses = t.managerPreference >= 85 && t.flexibility < 40;
  const demand =
    (p.coach?.salary || 1) *
    (1 +
      t.managerPreference / 100 +
      (100 - t.flexibility) / 200 +
      t.money / 200 +
      t.stubbornness / 300);
  return {
    refuses,
    demand,
    reason: refuses
      ? '감독직을 계속 맡고 싶습니다. 현재는 코치직 제안을 받지 않겠습니다.'
      : t.managerPreference >= 65
        ? '감독 경력을 내려놓는 만큼 보직 전환에 맞는 연봉을 원합니다.'
        : t.money >= 65
          ? '보직보다는 계약 보수를 중요하게 생각합니다. 조건이 맞으면 코치로 합류하겠습니다.'
          : '지도 역할을 이어갈 수 있다면 코치직도 검토하겠습니다.',
  };
}
export function playerPersonalityLabels(p: Player) {
  const t = playerPersonality(p);
  return [
    t.loyalty >= 80 ? '장기 잔류 선호' : t.loyalty >= 60 ? '구단 애착이 강함' : '새 구단에 개방적',
    t.ambition >= 70 ? '우승 도전 중시' : '안정적인 기용 선호',
    t.money >= 70 ? '연봉 중시' : '역할과 환경도 고려',
    t.stubbornness >= 75 ? '조건에 확고함' : '협상에 유연함',
  ];
}
