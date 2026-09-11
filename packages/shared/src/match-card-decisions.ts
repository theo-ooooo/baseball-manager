import type { LiveMatch } from './types';
import type { MatchCard } from './match-cards';
import { matchDecision } from './match-decision';

export const isAttackingCard = (card: MatchCard) =>
  ['power', 'contact', 'pitcherPressure'].includes(card.kind);

export const matchAugmentationSpent = (live: LiveMatch, own: boolean, cursor: number) =>
  !!live.timeline?.log
    .slice(0, cursor)
    .some((event) => event.play?.augmentations?.[own ? 'own' : 'opponent']);

/** Card timing uses only completed plays, never the next play's outcome. */
export function matchCardUseReason(live: LiveMatch, club: string, cursor: number, cardId: string) {
  const draft = live.cards;
  if (draft?.version !== 2 || !draft.selected) return '경기 전 카드 3장을 먼저 선택하세요.';
  const card = draft.offered.find(
    (entry) => entry.id === cardId && draft.selected!.includes(entry.id),
  );
  if (!card) return '이번 경기에 보유한 카드가 아닙니다.';
  if (draft.used?.some((use) => use.cardId === cardId)) return '이미 사용한 카드입니다.';
  if (draft.used?.some((use) => use.cursor === cursor))
    return '한 타석에는 카드 한 장만 사용할 수 있습니다.';
  if (!live.timeline || live.finished || cursor >= live.timeline.log.length)
    return '종료된 경기입니다.';
  const decision = matchDecision(live, club, cursor);
  if (!decision.kind) return '득점 기회·실점 위기에 사용할 수 있습니다.';
  if (isAttackingCard(card) !== decision.attacking)
    return isAttackingCard(card)
      ? '우리 팀 득점 기회에 사용하세요.'
      : '우리 팀 실점 위기에 사용하세요.';
  if (card.kind === 'nullify' && matchAugmentationSpent(live, false, cursor))
    return '상대 증강이 이미 소모되었습니다.';
  if (live.commands?.some((sign) => sign.cursor === cursor && sign.kind.startsWith('steal')))
    return '도루 사인을 취소한 뒤 타석용 카드를 사용하세요.';
  return '';
}
