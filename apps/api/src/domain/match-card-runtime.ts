import {
  effectiveMatchAugmentation,
  selectedMatchCards,
  type MatchCardDraft,
  type MatchCard,
} from '@dugout/shared/match-cards';
import { isAttackingCard } from '@dugout/shared/match-card-decisions';

/** A replay rebuild starts fresh and consumes effects from the same observed situations. */
export function createMatchCardRuntime(draft: MatchCardDraft | undefined) {
  const consumed = new Set<string>();
  const augmented = new Set<boolean>();
  return (
    cursor: number,
    ownBat: boolean,
    scoringPosition: boolean,
    steal: boolean,
    delegated: boolean,
  ) => {
    if (draft?.version !== 2 || !draft.selected || steal) return undefined;
    const ours = selectedMatchCards(draft);
    const automatic = (hand: MatchCard[], own: boolean) => {
      if (!scoringPosition) return undefined;
      const available = hand.filter(
        (card) =>
          !consumed.has(card.id) &&
          isAttackingCard(card) === (own === ownBat) &&
          (card.kind !== 'nullify' || !augmented.has(!own)),
      );
      return available.find((card) => card.kind === 'nullify') || available[0];
    };
    const manual = draft.used?.find((use) => use.cursor === cursor);
    const own = manual
      ? ours.find((card) => card.id === manual.cardId)
      : delegated
        ? automatic(ours, true)
        : undefined;
    const opponent = automatic(draft.opponent, false);
    for (const card of [own, opponent]) if (card) consumed.add(card.id);
    const active = { own: own ? [own] : [], opponent: opponent ? [opponent] : [] };
    const trigger = scoringPosition && !augmented.has(ownBat);
    if (trigger) augmented.add(ownBat);
    const augmentation = trigger ? effectiveMatchAugmentation(draft, ownBat, active) : undefined;
    return {
      active,
      augmentation,
      cards:
        own || opponent
          ? { ...(own ? { own: own.id } : {}), ...(opponent ? { opponent: opponent.id } : {}) }
          : undefined,
      augmentations: trigger
        ? {
            ...(ownBat ? { own: draft.augmentation } : { opponent: draft.opponentAugmentation }),
            ...(!augmentation ? { blocked: true as const } : {}),
          }
        : undefined,
    };
  };
}
