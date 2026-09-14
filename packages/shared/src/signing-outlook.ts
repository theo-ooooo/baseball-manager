import type { GameState, Player } from './types';
import { overall } from './game-view';
import { playerPersonality } from './personality';

/**
 * 영입 난이도의 기준값. 선수 기량이 구단 평판보다 높거나 야심이 클수록 커진다.
 * 협상(`recruitment`)과 스카우트 보고서가 같은 값을 쓰도록 여기 한 곳에 둔다.
 */
export function signingGap(g: GameState, p: Player) {
  const ambition = playerPersonality(p).ambition;
  return Math.max(0, overall(p) - g.reputation - 4 + Math.max(0, ambition - 70) / 5);
}

/** 협상에서 쓰는 기대 연봉. 잔류 재계약과 FA 평가액은 호출부에서 따로 처리한다. */
export function signingDemand(g: GameState, p: Player, staying = false) {
  const personality = playerPersonality(p);
  const temperament =
    1 +
    Math.max(0, personality.money - 60) / 400 +
    Math.max(0, personality.stubbornness - 70) / 600 -
    (staying ? personality.loyalty / 1200 : 0);
  return Math.max(5, Math.round(p.salary * (1.04 + signingGap(g, p) * 0.03) * temperament));
}

export type SigningOutlook = {
  chance: 'high' | 'moderate' | 'low' | 'unlikely';
  label: string;
  /** 스카우트 신뢰도만큼 좁아지는 기대 연봉 구간. */
  demand: [number, number];
  fee: number;
  /** 이적료·연봉·수수료를 현재 예산으로 감당할 수 있는지. */
  affordable: boolean;
  reason: string;
};

const labels: Record<SigningOutlook['chance'], string> = {
  high: '영입 가능성 높음',
  moderate: '조건 맞추면 가능',
  low: '설득 필요',
  unlikely: '영입 어려움',
};

/**
 * 스카우트가 보는 영입 전망. 실제 수락 여부는 협상에서 결정되므로 확정이 아니라
 * 관찰 기반 추정으로 제시한다. 신뢰도가 낮으면 연봉 구간이 넓어진다.
 */
export function signingOutlook(
  g: GameState,
  p: Player,
  fee: number,
  confidence: number,
  evaluatedSalary = signingDemand(g, p),
): SigningOutlook {
  const personality = playerPersonality(p);
  const gap = signingGap(g, p);
  const demand = evaluatedSalary;
  const spread = Math.max(0.1, (demand * (100 - confidence)) / 260);
  const free = p.club === 'fa';
  const affordable = fee + demand * 1.05 <= g.budget;
  const chance: SigningOutlook['chance'] = !affordable
    ? 'unlikely'
    : free || gap < 6
      ? 'high'
      : gap < 18
        ? 'moderate'
        : gap < 30
          ? 'low'
          : 'unlikely';
  const reason = !affordable
    ? `이적료와 첫해 연봉을 합치면 현재 예산을 넘습니다.`
    : free
      ? 'FA 신분이라 이적료 없이 조건만 맞추면 됩니다.'
      : gap >= 18
        ? `기량이 우리 구단 평판보다 앞서${personality.ambition >= 70 ? '고 야심도 큽니다' : '는 편입니다'}. 큰 폭의 조건 인상이 필요합니다.`
        : personality.money >= 70
          ? '연봉을 가장 중요하게 봅니다. 기대 연봉을 맞추면 응할 가능성이 있습니다.'
          : personality.ambition >= 70
            ? '우승 경쟁 가능성을 따집니다. 성적이 뒷받침되면 설득할 수 있습니다.'
            : '조건이 맞으면 이적을 검토할 만한 상황입니다.';
  return {
    chance,
    label: labels[chance],
    demand: [
      Math.max(0.01, Math.floor((demand - spread) * 100) / 100),
      Math.ceil((demand + spread) * 100) / 100,
    ],
    fee,
    affordable,
    reason:
      p.years > 1 && !free
        ? `${reason} 잔여 계약 ${p.years}년이라 원소속 구단 동의가 필요합니다.`
        : reason,
  };
}
