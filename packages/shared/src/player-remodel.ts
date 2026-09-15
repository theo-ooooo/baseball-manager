import type { AbilityKey, GameState, Player } from './types';
import { isClubSeasonRest } from './season-status';
export const remodelPlans = {
  slugger: {
    label: '장타형 스윙',
    detail: '스윙 폭을 키워 한 방을 노립니다.',
    pitcher: false,
    gain: 'power',
    amount: 4,
    cost: 'contact',
    loss: 2,
  },
  contact: {
    label: '짧고 간결한 스윙',
    detail: '큰 스윙을 줄이고 공을 맞히는 데 집중합니다.',
    pitcher: false,
    gain: 'contact',
    amount: 3,
    cost: 'power',
    loss: 2,
  },
  defense: {
    label: '수비 중심 몸 만들기',
    detail: '타격 비중을 낮추고 수비 동작을 다듬습니다.',
    pitcher: false,
    gain: 'field',
    amount: 4,
    cost: 'power',
    loss: 2,
  },
  powerPitch: {
    label: '힘으로 누르는 투구',
    detail: '공에 힘을 싣는 대신 섬세한 제구를 조금 내줍니다.',
    pitcher: true,
    gain: 'stuff',
    amount: 3,
    cost: 'control',
    loss: 2,
  },
  command: {
    label: '간결한 투구폼',
    detail: '힘을 덜 쓰고 일정한 릴리스에 집중합니다.',
    pitcher: true,
    gain: 'control',
    amount: 3,
    cost: 'stuff',
    loss: 1.5,
  },
} satisfies Record<
  string,
  {
    label: string;
    detail: string;
    pitcher: boolean;
    gain: AbilityKey;
    amount: number;
    cost: AbilityKey;
    loss: number;
  }
>;
export type RemodelKind = keyof typeof remodelPlans;
export const REMODEL_DAYS = 12;
export type PlayerRemodel = {
  kind: RemodelKind;
  year: number;
  club: string;
  started: string;
  days: number;
  lastDay?: string;
  status: 'training' | 'completed' | 'cancelled';
  finished?: string;
  finishedYear?: number;
  gained?: number;
  lost?: number;
};
export function remodelPause(g: GameState, p: Player) {
  if (p.remodel?.club !== g.club) return '이전 구단에서 시작한 개조';
  if (p.injury || p.internationalDuty) return '부상·대표팀 일정으로 대기';
  if (isClubSeasonRest(g)) return '시즌 휴식 중';
  if (p.condition < 60) return '컨디션 회복 대기';
  return '';
}
export function availableRemodels(p: Player) {
  return (Object.keys(remodelPlans) as RemodelKind[]).filter(
    (k) => remodelPlans[k].pitcher === (p.pos === 'P'),
  );
}

export function remodelUsed(g: GameState, p: Player) {
  return p.remodel?.year === g.year || p.remodel?.finishedYear === g.year;
}
