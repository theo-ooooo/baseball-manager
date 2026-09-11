import type { Player, GameState } from './types';
import { hash } from './game-view';
export const cardGrades = {
  bronze: { label: '브론즈', strength: 4 },
  silver: { label: '실버', strength: 7 },
  gold: { label: '골드', strength: 11 },
  diamond: { label: '다이아', strength: 16 },
} as const;
export const cardCatalog = {
  control: { name: '흔들리는 제구', target: '투수', attribute: 'control', label: '제구' },
  power: { name: '무거운 배트', target: '타자', attribute: 'power', label: '파워' },
  contact: { name: '엇갈린 타이밍', target: '타자', attribute: 'contact', label: '컨택' },
} as const;
export type TacticCard = {
  id: string;
  kind: keyof typeof cardCatalog;
  grade: keyof typeof cardGrades;
};
export type TacticCardState = {
  initialDrawn: boolean;
  hand: TacticCard[];
  armed?: { card: TacticCard; target: string; name: string; opponent: string };
  used: { card: TacticCard; target: string; name: string; matchId: string }[];
};
export function initialCards(seed: number): TacticCardState {
  const kinds = Object.keys(cardCatalog) as TacticCard['kind'][];
  return {
    initialDrawn: true,
    hand: Array.from({ length: 5 }, (_, i) => {
      const value = hash(`cards:${seed}:${i}`),
        roll = value % 100;
      return {
        id: `card-${seed}-${i}`,
        kind: kinds[(value >>> 8) % kinds.length],
        grade: roll < 55 ? 'bronze' : roll < 83 ? 'silver' : roll < 97 ? 'gold' : 'diamond',
      };
    }),
    used: [],
  };
}
export function cardTargetEligible(card: TacticCard, p: Player) {
  return card.kind === 'control' ? p.pos === 'P' : p.pos !== 'P';
}
export function cardEffectPlayer(g: GameState, p: Player) {
  const armed = g.tacticCards?.armed;
  if (
    !armed ||
    g.phase === 'preseason' ||
    armed.target !== p.id ||
    armed.opponent !== p.club ||
    p.club === g.club
  )
    return p;
  const attribute = cardCatalog[armed.card.kind].attribute;
  return { ...p, [attribute]: Math.max(1, p[attribute] - cardGrades[armed.card.grade].strength) };
}
