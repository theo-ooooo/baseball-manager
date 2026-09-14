import { hash } from '@dugout/shared/game-view';
import type { ManagerAbility } from '@dugout/shared/manager-ability';
import { managerAbilityKeys } from '@dugout/shared/manager-ability';
import type { ManagerBackground } from '@dugout/shared/manager-background';

/** Biography only: never advances the game RNG or fabricates real-person results. */
export function fictionalManagerBackground(
  id: string,
  appointed: string,
  city: string,
  ability: ManagerAbility,
): ManagerBackground {
  const year = Number(appointed.slice(0, 4));
  const best = managerAbilityKeys.reduce((a, b) => (ability[b] > ability[a] ? b : a));
  const years = 10 + (hash(`${id}:background-v1`) % 7);
  const beginnings = [
    ['지역 실업 야구팀', '선수', '선수 생활을 마친 뒤 지도자 과정을 밟았다.'],
    ['대학 야구부', '선수·학생 코치', '선수로 뛰면서 훈련 보조와 경기 기록을 맡았다.'],
    ['지역 야구 아카데미', '유소년 코치', '유소년 선수의 기본기 훈련부터 지도자 생활을 시작했다.'],
  ];
  const [team, role, detail] = beginnings[hash(`${id}:origin`) % beginnings.length];
  const specialties: Record<keyof ManagerAbility, [string, string]> = {
    tactics: ['작전 코치', '상대 분석과 주루·작전 훈련을 맡으며 경기 운영 경험을 쌓았다.'],
    bullpen: ['투수 코치', '투수별 등판 계획과 불펜 훈련을 담당했다.'],
    development: ['육성 코치', '유망주의 개인 훈련 계획과 1군 진입 준비를 도왔다.'],
    motivation: ['수석 코치', '선수 면담과 코칭스태프 조율을 맡아 선수단을 이끌었다.'],
    evaluation: ['전력분석 코치', '선수 관찰 보고와 영입 후보 평가를 담당했다.'],
  };
  const [specialty, experience] = specialties[best];
  return {
    version: 1,
    kind: 'fictional',
    summary: `${city}에서 지도자 경력을 시작했다. ${specialty} 경험을 바탕으로 감독직에 도전한 현장 출신 지도자.`,
    entries: [
      { from: String(year - years), to: String(year - 7), team: `${city} ${team}`, role, detail },
      {
        from: String(year - 6),
        to: String(year - 3),
        team: `${city} 지역 육성팀`,
        role: specialty,
        detail: experience,
      },
      {
        from: String(year - 2),
        to: String(year - 1),
        team: `${city} 독립 야구팀`,
        role: '감독',
        detail: '시즌 운영과 선수 선발을 책임지며 프로 구단의 기회를 준비했다.',
      },
    ],
  };
}
