'use client';
import { Zap } from 'lucide-react';
import { augmentationCatalog } from '@dugout/shared/augmentations';
import type { MatchCardDraft } from '@dugout/shared/match-cards';
import { useMatchDraw } from './use-match-draw';

export function MatchAugmentationReveal({ draft }: { draft: MatchCardDraft }) {
  const draw = useMatchDraw(draft.id, true);
  return (
    <section
      className={`match-augmentation-reveal ${draw.phase}`}
      aria-label="경기 증강 자동 추첨"
      aria-busy={draw.phase !== 'revealed'}
    >
      <header>
        <div>
          <h2>이번 경기 증강</h2>
        </div>
        <b>1회성</b>
      </header>
      <div className="match-card-augments">
        {[draft.augmentation, draft.opponentAugmentation].map((kind, side) => (
          <article key={side} className={augmentationCatalog[kind].tone}>
            <small>{side ? '상대 팀' : '우리 팀'} · 자동 추첨</small>
            <div className="augmentation-reel" aria-hidden={draw.phase !== 'revealed'}>
              {draw.phase === 'revealed' ? (
                <strong>
                  <Zap size={21} />
                  {augmentationCatalog[kind].name}
                </strong>
              ) : (
                <div className="augmentation-reel-strip" aria-hidden="true">
                  {[
                    ...Object.values(augmentationCatalog),
                    ...Object.values(augmentationCatalog),
                  ].map((a, i) => (
                    <strong key={i}>
                      {a.icon} {a.name}
                    </strong>
                  ))}
                </div>
              )}
            </div>
            {draw.phase === 'revealed' ? (
              <p>{augmentationCatalog[kind].description.replace('우리', side ? '상대' : '우리')}</p>
            ) : (
              <p>무작위 증강을 공개합니다…</p>
            )}
          </article>
        ))}
      </div>
      <p role="status">
        {draw.phase === 'revealed'
          ? '추첨 완료 · 첫 득점 기회의 한 타석에 자동 발동 후 소멸합니다. 무효화되어도 다시 발동하지 않습니다.'
          : '양 팀의 1회성 증강 추첨 중…'}
      </p>
    </section>
  );
}
