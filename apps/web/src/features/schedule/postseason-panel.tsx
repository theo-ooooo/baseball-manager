'use client';
import Link from 'next/link';
import { Trophy, ArrowUpRight, Flag } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { postseasonLabel, postseasonTarget } from '@dugout/shared/postseason';
import { PostseasonSeriesCard } from './postseason-series-card';
import { usePostseason } from './use-postseason';

export function PostseasonPanel({ g, compact = false }: { g: GameState; compact?: boolean }) {
  const view = usePostseason(g);
  if (!view) return null;
  return (
    <section
      className={`postseason-hub ${compact ? 'compact' : ''} ${view.champion ? 'champion' : ''}`}
      aria-label="포스트시즌 현황"
    >
      <header className="postseason-hero">
        <div className="postseason-trophy" aria-hidden="true">
          <Trophy size={compact ? 40 : 54} />
        </div>
        <div>
          <p>
            {g.year} · {view.league.name} <span>POSTSEASON</span>
          </p>
          <h2>{view.title}</h2>
          <span>{view.detail}</span>
        </div>
        {compact && (
          <Link href="/?view=schedule">
            대진·일정 보기 <ArrowUpRight size={17} />
          </Link>
        )}
      </header>
      {!compact && (
        <>
          <div className="postseason-rounds">
            {(['semifinal', 'final'] as const).map((stage) => {
              const round = view.post.rounds.find((r) => r.stage === stage),
                target = postseasonTarget(stage);
              return (
                <section
                  className="postseason-round"
                  key={stage}
                  aria-label={`${postseasonLabel(stage)} 대진`}
                >
                  <header>
                    <Flag size={15} />
                    <h3>{postseasonLabel(stage)}</h3>
                    <span>
                      {target * 2 - 1}전 {target}선승
                    </span>
                  </header>
                  {round ? (
                    round.series.map((series, index) => (
                      <PostseasonSeriesCard
                        key={`${stage}-${index}`}
                        series={series}
                        fixtures={round.fixtures.filter((f) => f.seriesIndex === index)}
                        target={target}
                        ownClub={g.club}
                      />
                    ))
                  ) : (
                    <div className="postseason-awaiting">
                      <Trophy size={28} />
                      <strong>
                        {stage === 'final'
                          ? '준결승 승자가 만납니다'
                          : '이전 준결승 일정이 없습니다'}
                      </strong>
                      <p>
                        {stage === 'final'
                          ? '두 시리즈 종료 후 첫 경기 날짜와 대진이 확정됩니다.'
                          : '이전 저장에 차전별 일정이 없어 확정된 챔피언십부터 표시합니다.'}
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <footer>
            게임 포스트시즌 규칙 · 정규시즌 상위 4개 구단 진출 · 기상 취소 시 차전 순서를 유지해
            재편성
          </footer>
        </>
      )}
    </section>
  );
}
