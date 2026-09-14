'use client';
import Link from 'next/link';
import { Trophy, ArrowUpRight, Flag } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { PostseasonWaitingCard } from './postseason-waiting-card';
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
          <div className={`postseason-rounds ${view.post.format === 'kbo' ? 'kbo' : ''}`}>
            {view.stages.map(
              ({
                stage,
                round,
                label,
                target,
                formatLabel,
                waitingClub,
                waitingTitle,
                waitingDetail,
              }) => {
                return (
                  <section className="postseason-round" key={stage} aria-label={`${label} 대진`}>
                    <header>
                      <Flag size={15} />
                      <h3>{label}</h3>
                      <span>{formatLabel}</span>
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
                      <PostseasonWaitingCard
                        club={waitingClub}
                        title={waitingTitle}
                        detail={waitingDetail}
                      />
                    )}
                  </section>
                );
              },
            )}
          </div>
          <footer>{view.ruleNote} · 기상 취소 시 차전 순서를 유지해 재편성</footer>
        </>
      )}
    </section>
  );
}
