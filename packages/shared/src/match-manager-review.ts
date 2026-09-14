import type { Result } from './types';
import { matchCommandResults } from './match-command-results';
import { matchCardCatalog, matchCardGrades } from './match-cards';
import { augmentationCatalog } from './augmentations';

/** Describes recorded outcomes; it does not estimate a counterfactual win probability. */
export function matchManagerReview(result: Result, club: string) {
  const manual = result.managerReview?.club === club ? result.managerReview.commands : [];
  const commands = matchCommandResults(
    { ...result, delegatedBy: undefined },
    result.log.length,
    club,
  ).map((entry) => ({
    ...entry,
    source: manual?.some((c) => c.cursor === entry.cursor)
      ? '감독 직접 지시'
      : result.delegatedBy && result.managerReview?.club === club
        ? `${result.delegatedBy} 위임`
        : '자동 판단',
  }));
  const draft = result.matchCards;
  const own = draft?.club === club;
  const side = own ? 'own' : 'opponent';
  const cards = (draft ? (own ? draft.own : draft.opponent) : []).map((card) => {
    const row = result.log.find((row) => row.play?.cards?.[side] === card.id);
    return {
      id: card.id,
      name: matchCardCatalog[card.kind].name,
      grade: matchCardGrades[card.grade].label,
      row,
    };
  });
  const augmentation = draft && (own ? draft.augmentation : draft.opponentAugmentation);
  const activation = result.log.find((row) => row.play?.augmentations?.[side]);
  const substitutions = result.log.flatMap((row) =>
    row.play?.pitchingChange && row.half !== (result.home === club ? 1 : 0) ? [row] : [],
  );
  const manualChanges = result.managerReview?.club === club ? result.managerReview.changes : [];
  return {
    commands,
    cards,
    augmentation: augmentation && {
      name: augmentationCatalog[augmentation].name,
      row: activation,
      legacy: draft?.version === 1,
    },
    substitutions,
    manualChanges,
  };
}
