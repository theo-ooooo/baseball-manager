'use client';
import Link from 'next/link';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
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

function CardDetails({ card }: { card: MatchCard }) {
  const spec = matchCardCatalog[card.kind];
  return (
    <>
      <small>{matchCardGrades[card.grade].label}</small>
      <span aria-hidden="true">{spec.icon}</span>
      <strong>{spec.name}</strong>
      <p>{matchCardDescription(card)}</p>
      <small>이번 경기 한정</small>
    </>
  );
}
export function MatchCardsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const h = useMatchCards(g, act, busy);
  const ours = augmentationCatalog[h.draft.augmentation],
    theirs = augmentationCatalog[h.draft.opponentAugmentation];
  return (
    <section className="match-page match-card-draft" aria-label="경기 카드 선택">
      <header>
        <Link href="/?view=home">← 구단으로</Link>
        <small>MATCH DAY · 경기 시작 전</small>
        <h1>
          오늘의 승부를 바꿀 <em>3장</em>
        </h1>
        <p>이번 경기에서만 사용할 카드 3장을 고르세요. 다음 경기에는 새로운 5장을 받습니다.</p>
      </header>
      <div className="match-card-augments">
        <article>
          <small>우리 팀 무작위 증강</small>
          <strong>
            <Sparkles size={19} />
            {ours.name}
          </strong>
          <p>{ours.description}</p>
        </article>
        <article>
          <small>상대 팀 무작위 증강</small>
          <strong>{theirs.name}</strong>
          <p>{theirs.description.replace('우리', '상대')}</p>
        </article>
      </div>
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
        <p>상대의 증강 무효화 카드는 우리 무작위 증강을 막습니다. 카드 자체의 효과는 유지됩니다.</p>
      </details>
      <div className="match-card-hand">
        {h.draft.offered.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`tactic-card ${card.grade}`}
            aria-pressed={h.selected.includes(card.id)}
            disabled={busy || (h.selected.length === 3 && !h.selected.includes(card.id))}
            onClick={() => h.toggle(card.id)}
          >
            <CardDetails card={card} />
            <i>{h.selected.includes(card.id) ? <Check size={20} aria-label="선택됨" /> : '선택'}</i>
          </button>
        ))}
      </div>
      <footer>
        <div>
          <strong aria-live="polite">{h.selected.length} / 3장 선택</strong>
          <small>확정 후에는 변경할 수 없습니다.</small>
        </div>
        <button
          className="button primary"
          disabled={busy || h.selected.length !== 3}
          onClick={() => void h.confirm()}
        >
          카드 확정 · 경기 준비 <ArrowRight size={18} />
        </button>
      </footer>
    </section>
  );
}
export function MatchCardsSummary({ draft }: { draft: MatchCardDraft }) {
  if (!draft.selected) return null;
  return (
    <details className="match-cards-summary">
      <summary>
        이번 경기 카드 · {augmentationCatalog[draft.augmentation].name}
        {!effectiveMatchAugmentation(draft, true) ? ' (상대 카드로 무효)' : ''}
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
              {effectiveMatchAugmentation(draft, !side) ? '적용 중' : '무효화됨'}
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
