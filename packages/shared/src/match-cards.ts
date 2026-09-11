import type { AugmentationKind } from './augmentations';
import type { Player } from './types';

export const matchCardGrades = {
  bronze: { label: '브론즈', percent: 5 },
  silver: { label: '실버', percent: 10 },
  gold: { label: '골드', percent: 15 },
  diamond: { label: '다이아', percent: 20 },
} as const;
export const matchCardCatalog = {
  power: { name: '파워 스윙', icon: '✦', description: '우리 타자 파워' },
  contact: { name: '정교한 타격', icon: '◈', description: '우리 타자 컨택' },
  control: { name: '정밀 제구', icon: '◎', description: '우리 투수 제구' },
  batterPressure: { name: '타선 봉쇄', icon: '↘', description: '상대 타자 컨택·파워' },
  pitcherPressure: { name: '마운드 흔들기', icon: '↙', description: '상대 투수 구위·제구' },
  nullify: {
    name: '증강 무효화',
    icon: '⊘',
    description: '상대 무작위 증강 발동을 무효화',
  },
} as const;
export type MatchCard = {
  id: string;
  kind: keyof typeof matchCardCatalog;
  grade: keyof typeof matchCardGrades;
};
export type MatchCardDraft = {
  version: 1 | 2;
  id: string;
  club: string;
  offered: MatchCard[];
  selected?: string[];
  opponent: MatchCard[];
  augmentation: AugmentationKind;
  opponentAugmentation: AugmentationKind;
  used?: { cardId: string; cursor: number }[];
};
export type ActiveMatchCards = { own: MatchCard[]; opponent: MatchCard[] };
export type MatchCardSummary = Pick<
  MatchCardDraft,
  'club' | 'augmentation' | 'opponentAugmentation' | 'opponent'
> & { own: MatchCard[]; version?: 1 | 2 };
export function selectedMatchCards(draft: MatchCardDraft) {
  return draft.offered.filter((card) => draft.selected?.includes(card.id));
}
export function matchCardDescription(card: MatchCard, own = true) {
  const spec = matchCardCatalog[card.kind];
  const description = own
    ? spec.description
    : spec.description.replace(/우리|상대/g, (word) => (word === '우리' ? '상대' : '우리'));
  return card.kind === 'nullify'
    ? description
    : `${description} ${card.kind.endsWith('Pressure') ? '−' : '+'}${matchCardGrades[card.grade].percent}%`;
}
export function matchCardSummary(draft: MatchCardDraft): MatchCardSummary {
  return {
    club: draft.club,
    own: selectedMatchCards(draft),
    opponent: draft.opponent,
    augmentation: draft.augmentation,
    opponentAugmentation: draft.opponentAugmentation,
    version: draft.version,
  };
}
export function effectiveMatchAugmentation(
  draft: MatchCardDraft,
  own: boolean,
  active?: ActiveMatchCards,
) {
  if (draft.version === 2 && !active) return undefined;
  if (draft.version === 1 && !draft.selected) return undefined;
  const blocking = active
    ? own
      ? active.opponent
      : active.own
    : draft.version === 2
      ? []
      : own
        ? draft.opponent
        : selectedMatchCards(draft);
  return blocking.some((card) => card.kind === 'nullify')
    ? undefined
    : own
      ? draft.augmentation
      : draft.opponentAugmentation;
}
/** Applied only to ephemeral match rosters, never to saved player attributes. */
export function matchCardPlayer(
  draft: MatchCardDraft,
  player: Player,
  own: boolean,
  active?: ActiveMatchCards,
): Player {
  if (!draft.selected) return player;
  if (draft.version === 2 && !active) return player;
  const ours = active?.own || selectedMatchCards(draft),
    theirs = active?.opponent || draft.opponent,
    cards = own ? ours : theirs,
    opposing = own ? theirs : ours;
  const strength = (hand: MatchCard[], kind: MatchCard['kind']) => {
    const card = hand.find((c) => c.kind === kind);
    return card ? matchCardGrades[card.grade].percent / 100 : 0;
  };
  const batter = player.pos !== 'P';
  const penalty = strength(opposing, batter ? 'batterPressure' : 'pitcherPressure');
  const adjust = (value: number, boost = 0) => Math.max(1, value * (1 + boost) * (1 - penalty));
  return batter
    ? {
        ...player,
        contact: adjust(player.contact, strength(cards, 'contact')),
        power: adjust(player.power, strength(cards, 'power')),
      }
    : {
        ...player,
        control: adjust(player.control, strength(cards, 'control')),
        stuff: adjust(player.stuff),
      };
}
