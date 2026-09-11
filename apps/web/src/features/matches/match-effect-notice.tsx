'use client';
import { Zap, ShieldBan, X } from 'lucide-react';
import type { Result } from '@dugout/shared/types';
import type { MatchCardDraft } from '@dugout/shared/match-cards';
import { matchCardCatalog } from '@dugout/shared/match-cards';
import { augmentationCatalog } from '@dugout/shared/augmentations';

export function MatchEffectNotice({
  event,
  draft,
  onDismiss,
}: {
  event?: Result['log'][number];
  draft: MatchCardDraft;
  onDismiss: () => void;
}) {
  const play = event?.play;
  if (!event || !play) return null;
  const augment = play.augmentations;
  return (
    <section
      className={`match-effect-notice ${augment?.blocked ? 'is-blocked' : ''}`}
      role="status"
      aria-label="카드와 증강 발동 결과"
    >
      {augment?.blocked ? <ShieldBan size={32} /> : <Zap size={32} />}
      <div>
        <small>
          {event.inning}회 {event.half ? '말' : '초'} · 이번 타석 한정
        </small>
        <strong>
          {augment ? (augment.blocked ? '증강 무효화!' : '증강 발동!') : '카드 발동!'}
        </strong>
        {augment && (
          <p>
            {augment.own ? '우리' : '상대'} ·{' '}
            {augmentationCatalog[(augment.own || augment.opponent)!].name} ·{' '}
            {augment.blocked ? '효과 차단 · 1회 소모' : '1회 발동 완료 · 소멸'}
          </p>
        )}
        {([true, false] as const).map((own) => {
          const id = play.cards?.[own ? 'own' : 'opponent'];
          const card = (own ? draft.offered : draft.opponent).find((entry) => entry.id === id);
          return card ? (
            <p key={id}>
              {own ? '우리' : '상대'} · {matchCardCatalog[card.kind].name} · 사용 완료
            </p>
          ) : null;
        })}
      </div>
      <button aria-label="발동 결과 닫기" onClick={onDismiss}>
        <X size={20} />
      </button>
    </section>
  );
}
