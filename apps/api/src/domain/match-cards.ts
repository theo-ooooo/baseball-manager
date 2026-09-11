import type { GameState } from '@dugout/shared/types';
import type { AugmentationKind } from '@dugout/shared/augmentations';
import { hash, rng } from '@dugout/shared/game-view';
import { matchCardCatalog, type MatchCard, type MatchCardDraft } from '@dugout/shared/match-cards';
import { generateTimeline, validateCursor } from './match-timeline';
import type { createMatchSimulator } from './match-simulation';

export function drawMatchCards(g: GameState): MatchCardDraft {
  const live = g.liveMatch!;
  const id = `${g.year}:${g.day}:${live.home}:${live.away}:${live.seed}`;
  // Separate random stream: opening the draft never consumes the simulation seed.
  const random = rng(hash(`match-cards-v1:${id}`));
  const hand = (side: string): MatchCard[] => {
    const kinds = Object.keys(matchCardCatalog) as MatchCard['kind'][];
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    return kinds.slice(0, 5).map((kind, i) => {
      const roll = random();
      return {
        id: `${id}:${side}:${i}`,
        kind,
        grade:
          kind === 'nullify'
            ? roll < 0.9
              ? 'gold'
              : 'diamond'
            : roll < 0.45
              ? 'bronze'
              : roll < 0.8
                ? 'silver'
                : roll < 0.96
                  ? 'gold'
                  : 'diamond',
      };
    });
  };
  const offered = hand('own'),
    opponent = hand('opponent').slice(0, 3);
  const kinds: AugmentationKind[] = ['zone', 'power', 'contact'];
  return {
    version: 1,
    id,
    club: g.club,
    offered,
    opponent,
    augmentation: kinds[Math.floor(random() * kinds.length)],
    opponentAugmentation: kinds[Math.floor(random() * kinds.length)],
  };
}
export function chooseMatchCards(
  g: GameState,
  action: Record<string, unknown>,
  simulate: ReturnType<typeof createMatchSimulator>,
) {
  const live = g.liveMatch,
    draft = live?.cards;
  if (!live || !draft || action.draftId !== draft.id || live.finished)
    throw new Error('현재 경기의 카드 선택을 다시 확인해 주세요.');
  if (validateCursor(live, action) !== 0 || live.cursor !== 0 || draft.selected)
    throw new Error('카드는 경기 시작 전에 한 번만 확정할 수 있습니다.');
  const ids = action.ids;
  if (
    !Array.isArray(ids) ||
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    ids.some((id) => typeof id !== 'string' || !draft.offered.some((c) => c.id === id))
  )
    throw new Error('이번 경기에서 받은 5장 중 서로 다른 카드 3장을 선택해 주세요.');
  draft.selected = [...ids];
  generateTimeline(g, simulate);
  return g;
}
