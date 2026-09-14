'use client';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { competitionChoices, type CompetitionChoice } from '@dugout/shared/lineup-competition';
import type { GameState } from '@dugout/shared/types';
import type { Act } from './game-contracts';
import { useLineupCompetition } from './use-lineup-competition';
export function LineupCompetitionPanel({
  g,
  act,
  busy,
  id,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  id?: string;
}) {
  const s = useLineupCompetition(g, act, busy, id),
    c = s.story;
  if (!c) return null;
  return (
    <section className="lineup-competition-panel" aria-label="주전 경쟁">
      <header>
        <span>
          {c.status === 'decision'
            ? '감독의 결정이 필요합니다'
            : c.status === 'trial'
              ? `약속을 지켜보는 중 · ${c.games}/6경기`
              : '주전 경쟁 결과'}
        </span>
        <h2>
          {c.veteran.name}의 자리, {c.prospect.name}의 도전
        </h2>
        <p>{c.evidence}</p>
      </header>
      {c.choice && (
        <p className="competition-policy">
          <strong>{competitionChoices[c.choice].label}</strong> ·{' '}
          {competitionChoices[c.choice].detail}
        </p>
      )}
      {c.mediation !== undefined && (
        <p>
          {c.mediator?.name}의 중재 {c.mediation ? '수용' : '난항'} · 선수들은 앞으로의 기용을
          지켜봅니다.
        </p>
      )}
      {c.status !== 'decision' && (
        <>
          <progress value={c.games} max={6} aria-label="주전 경쟁 평가 경기" />
          <div className="competition-scoreboard">
            {[c.veteran, c.prospect].map((p, index) => (
              <article key={p.id}>
                <span>{index ? '도전자' : '기존 주전'}</span>
                <h3>{p.name}</h3>
                <strong>
                  선발 {p.starts}경기
                  {c.choice &&
                    ` / 약속 ${competitionChoices[c.choice][index ? 'prospect' : 'veteran']}경기`}
                </strong>
                <p>
                  {p.ab}타수 {p.h}안타 · 홈런 {p.hr}개
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      {c.status === 'trial' && (
        <p>
          {s.paused
            ? '부상·대표팀 차출로 평가를 잠시 멈췄습니다. 두 선수가 돌아오면 이어갑니다.'
            : '두 선수가 건강하게 구단에 있는 공식 경기만 평가합니다. 부상·대표팀 차출 기간은 제외합니다.'}
        </p>
      )}
      {c.outcome && <p className="competition-outcome">{c.outcome}</p>}
      {c.status === 'decision' ? (
        <button className="button primary" disabled={!s.canAnswer} onClick={() => s.setOpen(true)}>
          선수들에게 방침 전달
        </button>
      ) : (
        c.status === 'trial' && (
          <Link className="text-button" href="/?view=tactics">
            두 선수의 선발 기회 준비 →
          </Link>
        )
      )}
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="bench-choice-dialog">
          <DialogHeader>
            <DialogTitle>누구에게 어떤 기회를 줄까요</DialogTitle>
            <DialogDescription>
              {c.veteran.name}과 {c.prospect.name}이 답변을 기다립니다. 말한 뒤의 실제 출전과 타격
              성적이 사기·감독 신뢰에 남습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="bench-choice-list" role="group" aria-label="주전 경쟁 방침">
            {(
              Object.entries(competitionChoices) as [
                CompetitionChoice,
                (typeof competitionChoices)[CompetitionChoice],
              ][]
            ).map(([key, v]) => (
              <button
                key={key}
                disabled={busy || (key === 'mediate' && !s.mediatorAvailable)}
                aria-pressed={s.choice === key}
                onClick={() => s.setChoice(key)}
              >
                <strong>{v.label}</strong>
                <span>{v.detail}</span>
                {key === 'mediate' && (
                  <small>
                    {s.mediatorAvailable
                      ? `중재 선수 · ${c.mediator!.name}`
                      : '현재 중재를 맡길 고참 선수가 없습니다.'}
                  </small>
                )}
              </button>
            ))}
          </div>
          <button
            className="button primary"
            disabled={!s.canAnswer || (s.choice === 'mediate' && !s.mediatorAvailable)}
            onClick={() => void s.submit()}
          >
            이 방침을 전달
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
