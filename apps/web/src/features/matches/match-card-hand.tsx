'use client';
import { Zap, Check } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import {
  matchCardCatalog,
  matchCardGrades,
  matchCardDescription,
} from '@dugout/shared/match-cards';
import { matchAugmentationSpent } from '@dugout/shared/match-card-decisions';
import { augmentationCatalog } from '@dugout/shared/augmentations';
import type { Act } from '../career/game-contracts';
import { useMatchCardHand } from './use-match-card-hand';

export function MatchCardHand({
  g,
  cursor,
  busy,
  paused,
  act,
}: {
  g: GameState;
  cursor: number;
  busy: boolean;
  paused: boolean;
  act: Act;
}) {
  const hand = useMatchCardHand(g, cursor, busy, paused, act);
  const live = g.liveMatch!,
    draft = live.cards!;
  return (
    <section className="match-reserved-hand" aria-label="보유한 1회용 카드">
      <header>
        <strong>
          승부 카드 <b>{hand.cards.filter((card) => !card.used).length} / 3</b>
        </strong>
        <span>{paused ? '기회·위기에 한 장 사용' : '타석이 끝난 뒤 사용'}</span>
      </header>
      <div className="match-augmentation-status">
        {[true, false].map((own) => (
          <span
            key={String(own)}
            className={matchAugmentationSpent(live, own, cursor) ? 'is-spent' : ''}
          >
            {own ? '우리' : '상대'} ·{' '}
            {augmentationCatalog[own ? draft.augmentation : draft.opponentAugmentation].name}
            <b>{matchAugmentationSpent(live, own, cursor) ? '소모 완료' : '1회 대기'}</b>
          </span>
        ))}
      </div>
      {hand.recommendation && (
        <div className="match-card-recommendation" role="region" aria-label="코치 카드 추천">
          <small>{hand.recommendation.coach} · 카드 추천</small>
          <strong>{matchCardCatalog[hand.recommendation.card.kind].name}</strong>
          <p>{hand.recommendation.reason}</p>
          <button
            disabled={busy || !paused}
            onClick={() => void hand.use(hand.recommendation!.card.id)}
          >
            추천 카드 사용 · 1회 소모
          </button>
        </div>
      )}
      <details open={paused && hand.cards.some((card) => !card.used && !card.reason)}>
        <summary>보유 카드 보기 · 기회·위기에 사용</summary>
        <div className="match-use-cards">
          {hand.cards.map(({ card, used, reason }) => (
            <button
              key={card.id}
              className={`${card.grade} ${used ? 'is-spent' : ''}`}
              disabled={busy || !paused || used || !!reason}
              onClick={() => void hand.use(card.id)}
              title={reason || '다음 한 타석에 사용 · 한 번 쓰면 소모'}
            >
              <small>{matchCardGrades[card.grade].label} · 1회용</small>
              <strong>
                {matchCardCatalog[card.kind].icon} {matchCardCatalog[card.kind].name}
              </strong>
              <span>{matchCardDescription(card)}</span>
              <b>
                {used ? (
                  <>
                    <Check size={14} /> 사용 완료
                  </>
                ) : (
                  reason || '지금 사용 →'
                )}
              </b>
            </button>
          ))}
        </div>
      </details>
      {hand.pending && (
        <div key={hand.pending.id} className="match-card-activation" role="status">
          <Zap size={28} />
          <div>
            <small>카드 발동 준비 · 재사용 불가</small>
            <strong>{matchCardCatalog[hand.pending.kind].name} 사용!</strong>
            <p>다음 한 타석에만 적용됩니다. 사인을 정하고 계속 진행하세요.</p>
          </div>
        </div>
      )}
    </section>
  );
}
