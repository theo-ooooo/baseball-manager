'use client';
import { Check, ArrowRight, Layers } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { GameState } from '@dugout/shared/types';
import { augmentationCatalog } from '@dugout/shared/augmentations';
import {
  matchCardCatalog,
  matchCardGrades,
  matchCardDescription,
  selectedMatchCards,
  effectiveMatchAugmentation,
  type MatchCardDraft,
  type MatchCard,
} from '@dugout/shared/match-cards';
import type { Act } from '../career/game-contracts';
import { useMatchCards } from './use-match-cards';
import { useMatchDraw } from './use-match-draw';
import { isAttackingCard } from '@dugout/shared/match-card-decisions';

function CardDetails({ card }: { card: MatchCard }) {
  const spec = matchCardCatalog[card.kind];
  return (
    <>
      <small>{matchCardGrades[card.grade].label}</small>
      <span aria-hidden="true">{spec.icon}</span>
      <strong>{spec.name}</strong>
      <p>{matchCardDescription(card)}</p>
      <small>{isAttackingCard(card) ? '득점 기회' : '실점 위기'} · 한 타석 · 1회용</small>
    </>
  );
}
export function MatchCardsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const h = useMatchCards(g, act, busy);
  const draw = useMatchDraw(h.draft.id);
  return (
    <section className={`match-card-draft ${draw.phase}`} aria-label="카드 받기와 선택">
      <div className="match-draft-aug-summary">
        <span>
          우리 증강 <b>{augmentationCatalog[h.draft.augmentation].name}</b>
        </span>
        <span>
          상대 증강 <b>{augmentationCatalog[h.draft.opponentAugmentation].name}</b>
        </span>
        <small>각 팀 첫 득점 기회에 1회 자동 발동</small>
      </div>
      {draw.phase === 'ready' && (
        <button className="match-card-pack" disabled={busy} onClick={draw.draw}>
          <span className="card-pack-stack" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ '--card-index': i } as CSSProperties}>
                <Layers size={32} />
                <b>DUGOUT</b>
              </i>
            ))}
          </span>
          <strong>
            카드 5장 받기 <ArrowRight size={19} />
          </strong>
          <small>눌러서 카드 공개</small>
        </button>
      )}
      <details className="match-opponent-cards">
        <summary>상대가 준비한 카드 3장</summary>
        <ul>
          {h.draft.opponent.map((card) => (
            <li key={card.id}>
              <b>
                {matchCardGrades[card.grade].label} · {matchCardCatalog[card.kind].name}
              </b>
              <span>{matchCardDescription(card, false)}</span>
            </li>
          ))}
        </ul>
        <p>
          상대도 기회·위기에 카드를 한 장씩 사용합니다. 무효화 카드는 상대 증강의 1회 발동을
          막습니다.
        </p>
      </details>
      {draw.phase !== 'ready' && (
        <div className="match-card-hand" aria-busy={draw.phase === 'drawing'}>
          {h.draft.offered.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`tactic-card ${card.grade}`}
              style={{ '--card-index': index } as CSSProperties}
              aria-pressed={h.selected.includes(card.id)}
              disabled={
                draw.phase !== 'revealed' ||
                busy ||
                (h.selected.length === 3 && !h.selected.includes(card.id))
              }
              onClick={() => h.toggle(card.id)}
            >
              <CardDetails card={card} />
              <i>
                {h.selected.includes(card.id) ? <Check size={20} aria-label="선택됨" /> : '선택'}
              </i>
            </button>
          ))}
        </div>
      )}
      {draw.phase !== 'ready' && (
        <footer>
          <div>
            <strong aria-live="polite">{h.selected.length} / 3장 선택</strong>
            <small>보유 중에는 효과 없음 · 경기 중 직접 사용</small>
          </div>
          <button
            className="button primary"
            disabled={draw.phase !== 'revealed' || busy || h.selected.length !== 3}
            onClick={() => void h.confirm()}
          >
            3장 보유 · 경기 준비 <ArrowRight size={18} />
          </button>
        </footer>
      )}
    </section>
  );
}
export function MatchCardsSummary({ draft }: { draft: MatchCardDraft }) {
  if (!draft.selected) return null;
  return (
    <details className="match-cards-summary">
      <summary>
        이번 경기 카드 ·{' '}
        {draft.version === 2
          ? '보유 3장 · 한 장당 1회용'
          : augmentationCatalog[draft.augmentation].name}
        {draft.version === 1 && !effectiveMatchAugmentation(draft, true)
          ? ' (상대 카드로 무효)'
          : ''}
      </summary>
      <div>
        {[
          [selectedMatchCards(draft), '우리 팀'],
          [draft.opponent, '상대 팀'],
        ].map(([cards, label], side) => (
          <section key={String(label)}>
            <strong>{String(label)}</strong>
            <p>
              증강:{' '}
              {augmentationCatalog[side ? draft.opponentAugmentation : draft.augmentation].name} ·{' '}
              {draft.version === 2
                ? '첫 득점 기회에 1회 자동 발동'
                : effectiveMatchAugmentation(draft, !side)
                  ? '적용 중'
                  : '무효화됨'}
            </p>
            <ul>
              {(cards as MatchCard[]).map((card) => (
                <li key={card.id}>
                  {matchCardGrades[card.grade].label} · {matchCardCatalog[card.kind].name}
                  <small>{matchCardDescription(card, side === 0)}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
