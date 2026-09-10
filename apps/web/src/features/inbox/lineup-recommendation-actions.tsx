'use client';
import Link from 'next/link';
import { gameDate } from '@dugout/shared/calendar';
import type { GameState, NewsItem } from '@dugout/shared/types';
import { lineupRecommendationError } from '@dugout/shared/lineup-recommendation';
import type { Act } from '../career/game-contracts';
export function LineupRecommendationActions({
  g,
  news,
  act,
  busy,
}: {
  g: GameState;
  news: NewsItem;
  act: Act;
  busy: boolean;
}) {
  const report = news.lineupRecommendation;
  if (!report) return null;
  const error = lineupRecommendationError(g, news);
  const pending = report.status === 'pending';
  return (
    <section className="inbox-lineup-proposal" aria-label="코치 추천 명단 결정">
      <h3>
        {report.status === 'applied'
          ? '추천 명단을 적용했습니다'
          : report.status === 'dismissed'
            ? '감독님의 기존 명단을 유지합니다'
            : '이 명단으로 준비할까요?'}
      </h3>
      <p>
        {pending
          ? error ||
            '선발 9명·타순·수비 배치와 선발 투수를 함께 적용합니다. 적용 후에도 전술 화면에서 수정할 수 있습니다.'
          : '현재 타순과 수비는 전술 화면에서 확인할 수 있습니다.'}
      </p>
      <div>
        {pending && (
          <button
            className="button primary"
            disabled={busy || !!error}
            onClick={() => void act({ type: 'lineupRecommendation', id: news.id, choice: 'apply' })}
          >
            추천 명단 적용
          </button>
        )}
        <Link className="button secondary" href="/?view=tactics&panel=lineup">
          타순 · 수비 직접 수정
        </Link>
        {pending && (
          <button
            className="button secondary"
            disabled={busy || !!g.liveMatch}
            onClick={() =>
              void act({ type: 'lineupRecommendation', id: news.id, choice: 'dismiss' })
            }
          >
            기존 명단 유지
          </button>
        )}
      </div>
      {pending && error && report.club === g.club && report.date >= gameDate(g) && (
        <button
          className="text-button"
          disabled={busy || !!g.liveMatch}
          onClick={() => void act({ type: 'lineupRecommendation', id: news.id, choice: 'refresh' })}
        >
          현재 선수단으로 다시 추천받기
        </button>
      )}
    </section>
  );
}
