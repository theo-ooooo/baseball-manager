import type { GameState } from './types';
export const augmentationCatalog = {
  zone: {
    name: '좁아진 스트라이크존',
    icon: '◎',
    description: '우리 타자의 볼넷 확률 +3.5%p · 아웃 중 삼진 확률 −6%p',
    tone: 'violet',
  },
  power: {
    name: '파워 히트',
    icon: '✦',
    description: '우리 팀 안타가 홈런이 될 확률 +8%p',
    tone: 'gold',
  },
  contact: {
    name: '배트에 붙는 공',
    icon: '◈',
    description: '우리 타자의 안타 확률 +3%p · 안타 중 홈런 확률 −2.5%p',
    tone: 'green',
  },
} as const;
export type AugmentationKind = keyof typeof augmentationCatalog;
export type AugmentationState = {
  club: string;
  enabled: boolean;
  games: number;
  credits: number;
  lastMatch?: string;
  active?: { kind: AugmentationKind; remaining: number };
  history: { kind: AugmentationKind; date: string }[];
};
export function matchAugmentation(g: GameState) {
  return g.augmentations?.enabled &&
    g.augmentations.club === g.club &&
    (g.augmentations.active?.remaining || 0) > 0 &&
    g.phase !== 'preseason'
    ? g.augmentations.active?.kind
    : undefined;
}
export function augmentationModifiers(kind: AugmentationKind | undefined) {
  return {
    walk: kind === 'zone' ? 0.035 : 0,
    strikeout: kind === 'zone' ? -0.06 : 0,
    contact: kind === 'contact' ? 0.03 : 0,
    homeRun: kind === 'power' ? 0.08 : kind === 'contact' ? -0.025 : 0,
  };
}
