import type { ManagerAbility } from './manager-ability';
import type { ManagerBackground } from './manager-background';

/** 선수 경력에서 정한 게임 특성. 경력 정보가 없으면 보정을 만들지 않는다. */
export function managerPlayingTrait(background?: ManagerBackground) {
  const position = background?.playingCareer?.position.split(/→|->/).at(-1)?.trim();
  if (!position) return undefined;
  const traits: {
    pattern: RegExp;
    name: string;
    detail: string;
    bonus: Partial<ManagerAbility>;
  }[] = [
    {
      pattern: /포수|^C$/,
      name: '포수의 시야',
      detail: '배터리 호흡과 선수단 소통에 익숙합니다.',
      bonus: { bullpen: 3, motivation: 1 },
    },
    {
      pattern: /투수|^P$/,
      name: '마운드 경험',
      detail: '투수 상태와 불펜 투입 시점을 읽는 데 강점이 있습니다.',
      bonus: { bullpen: 4, evaluation: 1 },
    },
    {
      pattern: /내야|루수|유격|^(SS|[123]B|IF)$/,
      name: '내야의 연결',
      detail: '수비 조직과 주자 움직임을 지도하는 데 강점이 있습니다.',
      bonus: { tactics: 3, development: 1 },
    },
    {
      pattern: /외야|중견|좌익|우익|^(CF|LF|RF|OF)$/,
      name: '넓은 시야',
      detail: '주루 판단과 선수의 움직임을 살피는 데 익숙합니다.',
      bonus: { tactics: 2, evaluation: 2 },
    },
    {
      pattern: /타자|지명|^DH$/,
      name: '타석의 기억',
      detail: '타자의 접근법과 타격 훈련을 돕습니다.',
      bonus: { development: 3, tactics: 1 },
    },
  ];
  const trait = traits.find((t) => t.pattern.test(position));
  return trait && { name: trait.name, detail: trait.detail, bonus: trait.bonus };
}
export function applyManagerTrait(
  ability: ManagerAbility,
  background?: ManagerBackground,
): ManagerAbility {
  const bonus = managerPlayingTrait(background)?.bonus || {};
  return Object.fromEntries(
    Object.entries(ability).map(([key, value]) => [
      key,
      Math.min(95, value + (bonus[key as keyof ManagerAbility] || 0)),
    ]),
  ) as ManagerAbility;
}
