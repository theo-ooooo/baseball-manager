import { hash } from '@dugout/shared/game-view';
import type { ManagerAbility } from '@dugout/shared/manager-ability';
import { managerAbilityKeys } from '@dugout/shared/manager-ability';
import type { ManagerBackground } from '@dugout/shared/manager-background';

/** Extend saved biographies in place: an appointment or reputation change must not rewrite a life. */
export function addFictionalPlayingCareer(id: string, background: ManagerBackground) {
  if (background.kind !== 'fictional' || background.playingCareer) return background;
  const first = background.entries[0];
  if (!first) return background;
  const existing = background.entries.filter((entry) => entry.role.startsWith('선수'));
  const city = first.team.replace(/ (지역 실업 야구팀|대학 야구부|지역 야구 아카데미)$/, '');
  const profiles = [
    ['포수', '투수와 호흡을 맞추고 상대 타자의 타격 습관을 기록하는 포수였다.'],
    ['투수', '구위보다 제구와 완급 조절로 타자를 상대하던 투수였다.'],
    ['유격수', '수비 위치를 조율하고 병살 플레이를 이끄는 내야수였다.'],
    ['2루수', '출루와 진루타, 주루 판단으로 공격을 이어가는 선수였다.'],
    ['중견수', '넓은 수비 범위와 빠른 발을 살려 팀에 보탬이 됐다.'],
    ['1루수', '타석에서 끈질기게 승부하고 후배들의 타격 연습을 함께 챙겼다.'],
  ];
  const [position, summary] = profiles[hash(`${id}:playing-position-v1`) % profiles.length];
  const retired = existing.length
    ? Number((existing.at(-1)!.to || first.from).slice(0, 4))
    : Number(first.from.slice(0, 4)) - 1;
  const entries = existing.length
    ? existing.map((entry) => ({ ...entry }))
    : [
        {
          from: String(retired - 3 - (hash(`${id}:playing-years-v1`) % 5)),
          to: String(retired),
          team: `${city} 지역 실업 야구팀`,
          role: '선수',
        },
      ];
  background.playingCareer = {
    from: entries[0].from,
    to: String(retired),
    position,
    summary,
    retirement: `${retired}년 선수 생활을 마쳤다. 현장에서 쌓은 경험을 후배들에게 전하기 위해 지도자의 길을 택했다.`,
    entries,
  };
  background.version = 2;
  return background;
}

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
  return addFictionalPlayingCareer(id, {
    version: 1,
    kind: 'fictional',
    summary: `${city}에서 지도자 경력을 시작했다. ${specialty} 경험을 바탕으로 감독직에 도전한 현장 출신 지도자.`,
    entries: [
      {
        from: String(year - (role === '선수·학생 코치' ? 10 : years)),
        to: String(year - 7),
        team: `${city} ${team}`,
        role,
        detail,
      },
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
  });
}
