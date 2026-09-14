'use client';
import Link from 'next/link';
import { Flag, UserRoundPlus, ArrowRight, Newspaper } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState, Player } from '@dugout/shared/types';
import {
  prospectGoals,
  type ProspectGoal,
  type MatchStakes,
} from '@dugout/shared/career-engagement';
import type { Act } from './game-contracts';
import { useCareerExperience } from './use-career-experience';

export function MatchStakesBanner({ stakes }: { stakes: MatchStakes }) {
  return (
    <section className={`career-stakes ${stakes.kind}`} aria-label="오늘 승부의 의미">
      <span>
        <Flag size={15} /> 오늘 이 경기를 이겨야 하는 이유
      </span>
      <h2>{stakes.title}</h2>
      <p>{stakes.detail}</p>
    </section>
  );
}
export function CareerStoryPanel({
  g,
  act,
  busy,
  onPlayer,
  onReport,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onReport: (id: string) => void;
}) {
  const s = useCareerExperience(g, act, busy);
  return (
    <section className="career-story-desk" aria-label="구단의 이야기">
      {s.stakes && <MatchStakesBanner stakes={s.stakes} />}
      <div className="career-story-heading">
        <div>
          <span>내가 믿는 선수</span>
          <h2>
            {s.profiles.length
              ? '이 선수들의 다음 경기를 기다립니다'
              : '다음 주역을 직접 골라주세요'}
          </h2>
        </div>
        <button
          className="button secondary compact"
          disabled={busy}
          onClick={() => s.setOpen(true)}
        >
          <UserRoundPlus size={16} /> 육성 선수 지명
        </button>
      </div>
      {!s.profiles.length ? (
        <p className="career-story-empty">
          23세 이하 선수 세 명까지 지켜볼 수 있습니다. 선발 기회와 훈련은 감독의 선택, 목표를 이루는
          과정은 이곳에 남습니다.
        </p>
      ) : (
        <div className="prospect-story-list">
          {s.profiles.map(({ story, player, value, goal }) => (
            <article key={story.id} className={story.completed ? 'achieved' : ''}>
              <div className="prospect-story-name">
                <button onClick={() => player && onPlayer(player)} disabled={!player}>
                  <strong>{story.name}</strong>
                  <small>
                    {player
                      ? `${player.age}세 · ${player.pos} · ${player.squad === 'reserve' ? '2군' : '1군'}`
                      : '구단을 떠난 선수'}
                  </small>
                </button>
                <span>{story.completed ? '목표 달성' : `${value}/${goal.target}`}</span>
              </div>
              <p>{goal.label}</p>
              <progress
                max={goal.target}
                value={Math.min(value, goal.target)}
                aria-label={`${story.name} ${goal.label}`}
              />
              <p className="prospect-story-moment">
                {story.moments.at(-1)?.title || '지명 후 첫 1군 출전을 기다립니다.'}
              </p>
              <details>
                <summary>함께한 기록 {story.moments.length}건</summary>
                <small>{story.since} 지명 이후 기록</small>
                <ol>
                  {story.moments.map((m) => (
                    <li key={m.key}>
                      <time>{m.date.slice(5)}</time>
                      <span>{m.title}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="prospect-story-actions">
                <Link href="/?view=reserves">
                  출전 기회 준비 <ArrowRight size={13} />
                </Link>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void s.unfollow(story.id)}
                >
                  지켜보기 해제
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <details className="career-weekly">
        <summary>
          <Newspaper size={16} /> 지난 7일 브리핑{' '}
          <span>
            {s.briefing.matches}경기 · {s.briefing.wins}승 · 안 읽은 일반 소식 {s.briefing.unread}건
          </span>
        </summary>
        <p>일반 소식은 경기 진행을 멈추지 않습니다. 필요한 보고를 골라 읽으세요.</p>
        <ul>
          {s.briefing.news.slice(0, 8).map((n) => (
            <li key={n.id}>
              <button onClick={() => onReport(n.id)}>
                {!n.read && <b aria-label="안 읽음">●</b>} {n.title}
              </button>
            </li>
          ))}
        </ul>
        {!s.briefing.news.length && <p>이번 주에는 아직 모인 소식이 없습니다.</p>}
      </details>
      <label className="career-report-preference">
        진행 중 멈추는 보고
        <select
          aria-label="보고 진행 방식"
          value={g.engagement?.reportMode || 'important'}
          disabled={busy}
          onChange={(e) => void act({ type: 'careerReportMode', mode: e.target.value })}
        >
          <option value="important">중요한 보고만</option>
          <option value="all">모든 보고</option>
        </select>
      </label>
      <label className="career-report-preference">
        반복 인터뷰
        <select
          aria-label="인터뷰 진행 방식"
          value={g.engagement?.interviews || 'coach'}
          disabled={busy}
          onChange={(e) => void act({ type: 'careerInterviews', mode: e.target.value })}
        >
          <option value="coach">코치에게 맡기기</option>
          <option value="manual">직접 답하기</option>
        </select>
      </label>
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="prospect-pick-dialog">
          <DialogHeader>
            <DialogTitle>내가 믿는 선수 지명</DialogTitle>
            <DialogDescription>
              23세 이하 우리 선수 중 세 명까지 선택할 수 있습니다. 기록은 지명 이후부터 쌓이며
              재지명해도 이어집니다.
            </DialogDescription>
          </DialogHeader>
          <div className="prospect-pick-list" role="group" aria-label="육성 후보">
            {s.candidates.map((p) => (
              <button key={p.id} aria-pressed={s.selected === p.id} onClick={() => s.choose(p.id)}>
                <strong>{p.name}</strong>
                <span>
                  {p.age}세 · {p.pos} · {p.squad === 'reserve' ? '2군' : '1군'}
                </span>
              </button>
            ))}
          </div>
          {!s.candidates.length && (
            <p>
              현재 선수단에 23세 이하 선수가 없습니다. 유망주 영입이나 신인 선발 후 지명할 수
              있습니다.
            </p>
          )}
          {s.player && (
            <label>
              함께 이룰 목표
              <select
                aria-label="육성 목표"
                disabled={!!s.existingGoal}
                value={s.goal}
                onChange={(e) => s.setGoal(e.target.value as ProspectGoal)}
              >
                {Object.entries(prospectGoals)
                  .filter(([key]) =>
                    s.player!.pos === 'P'
                      ? ['starts', 'strikeouts'].includes(key)
                      : key !== 'strikeouts',
                  )
                  .map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="button primary"
            disabled={busy || !s.player}
            onClick={() => void s.follow()}
          >
            {s.existingGoal ? '기존 목표를 이어서 지켜보기' : '이 선수를 믿어보기'}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
