'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Users, ArrowRight } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import {
  preMatchConversation,
  type MatchConversation,
  type ConversationRecord,
} from '@dugout/shared/match-media';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { ClubBadge } from '../../components/club-badge';

export function MatchConversationPanel({
  g,
  act,
  busy,
  onContinue,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onContinue: () => void;
}) {
  const { nextFixture, getClub } = useWorld();
  const pair = nextFixture(g);
  const pre = pair
    ? preMatchConversation(g, pair, getClub(pair.find((id) => id !== g.club)!).name)
    : null;
  const context = g.media?.pending || pre;
  const [selected, setSelected] = useState<string | null>(null);
  const journal = g.media?.journal || [];
  const prior = selected ? journal.find((r) => r.key === selected) : undefined;
  const completed =
    prior || journal.find((r) => r.key === context?.key) || (!context ? journal[0] : undefined);
  return (
    <div className="match-media-page">
      <section
        className={`media-room ${!completed && context?.questions[0].room === 'team' ? 'locker-room' : ''}`}
      >
        <header className="media-room-header">
          <ClubBadge club={getClub(g.club)} size="small" />
          <div>
            <span>MEDIA ROOM · CLUBHOUSE</span>
            <h2>감독의 한마디</h2>
          </div>
          <small>{context?.date || completed?.date || '구단 일정'}</small>
        </header>
        {completed ? (
          <ConversationResult
            record={completed}
            onContinue={prior ? () => setSelected(null) : onContinue}
            busy={busy}
            historical={!!prior}
          />
        ) : context ? (
          <ConversationForm key={context.key} context={context} g={g} act={act} busy={busy} />
        ) : (
          <div className="media-empty">
            <Mic size={32} />
            <h3>지금은 예정된 인터뷰가 없습니다</h3>
            <p>
              경기 준비에서 경기 전 인터뷰를 진행하고, 경기 후 보고에서 기자회견과 라커룸 대화로
              이어집니다.
            </p>
            <button className="button primary" onClick={onContinue}>
              다음 일정 확인 <ArrowRight size={16} />
            </button>
          </div>
        )}
        {prior && (
          <button className="button secondary media-return" onClick={() => setSelected(null)}>
            현재 인터뷰로 돌아가기
          </button>
        )}
      </section>
      {!!journal.length && (
        <section className="media-journal">
          <h3>지난 발언과 선수 반응</h3>
          <p>최근 20회의 경기 전·후 대화 기록</p>
          {journal.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              aria-pressed={selected === r.key}
            >
              <time>{r.date}</time>
              <strong>
                {r.stage === 'pre' ? '경기 전' : '경기 후'} · {r.opponent}
              </strong>
              <span>{r.delegated ? '코치 위임' : '감독 참석'}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
function ConversationForm({
  context,
  g,
  act,
  busy,
}: {
  context: MatchConversation;
  g: GameState;
  act: Act;
  busy: boolean;
}) {
  const [at, setAt] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const questionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    questionHeading.current?.focus();
  }, [at]);
  const question = context.questions[at],
    last = at === context.questions.length - 1;
  const coach = g.staff.find((c) => c.role === '수석') || g.staff[0];
  const selected = answers[question.id];
  return (
    <form
      className={`media-conversation ${question.room === 'team' ? 'is-team-talk' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !selected) return;
        if (!last) {
          setAt(at + 1);
          return;
        }
        await act({
          type: 'matchConversation',
          stage: context.stage,
          key: context.key,
          answers: context.questions.map((q) => ({ id: q.id, choice: answers[q.id] })),
        });
      }}
    >
      <div className="media-brief">
        <span>
          {context.stage === 'pre' ? '경기 전' : '경기 후'} ·{' '}
          {question.room === 'press' ? '기자회견' : '라커룸 팀 대화'}
        </span>
        <strong>{context.summary}</strong>
      </div>
      <ol className="media-steps" aria-label="인터뷰와 팀 대화 순서">
        {context.questions.map((q, i) => (
          <li key={q.id} aria-current={i === at ? 'step' : undefined}>
            {i < 2 ? <Mic size={14} /> : <Users size={14} />}
            <span>{i < 2 ? `질문 ${i + 1}` : '팀 대화'}</span>
            {answers[q.id] && <Check size={13} />}
          </li>
        ))}
      </ol>
      <section className="media-question" aria-live="polite">
        <small>{question.speaker}</small>
        <h3 ref={questionHeading} tabIndex={-1}>
          {question.text}
        </h3>
      </section>
      <fieldset className="media-answers" disabled={busy}>
        <legend>어떻게 답하시겠습니까?</legend>
        {question.choices.map((choice) => (
          <label key={choice.id} className={selected === choice.id ? 'is-selected' : ''}>
            <input
              type="radio"
              name={question.id}
              value={choice.id}
              checked={selected === choice.id}
              onChange={() => setAnswers({ ...answers, [question.id]: choice.id })}
            />
            <span>
              <small>{choice.tone}</small>
              <strong>{choice.text}</strong>
            </span>
            {selected === choice.id && <Check size={19} />}
          </label>
        ))}
      </fieldset>
      <p className="media-coach-note">
        {question.room === 'team'
          ? '같은 말도 선수의 컨디션·현재 사기와 경험에 따라 다르게 받아들입니다.'
          : '공개 발언은 출전 선수들에게 전달됩니다. 마지막 팀 대화까지 마친 뒤 한 번에 전달합니다.'}
      </p>
      <footer className="media-conversation-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy || at === 0}
          onClick={() => setAt(at - 1)}
        >
          이전 질문
        </button>
        <button type="submit" className="button primary" disabled={busy || !selected}>
          {busy ? '메시지 전달 중…' : last ? '답변·팀 대화 전달' : '다음 질문'}
          <ArrowRight size={16} />
        </button>
      </footer>
      <div className="media-delegate">
        <div>
          <strong>{coach ? `${coach.name} 코치` : '코칭 스태프'}</strong>
          <small>인터뷰와 팀 대화를 차분한 메시지로 대신 진행합니다.</small>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy || !coach}
          onClick={() =>
            void act({
              type: 'matchConversation',
              stage: context.stage,
              key: context.key,
              delegated: true,
            })
          }
        >
          코치에게 맡기기
        </button>
      </div>
    </form>
  );
}
function ConversationResult({
  record,
  onContinue,
  busy,
  historical = false,
}: {
  record: ConversationRecord;
  onContinue: () => void;
  busy: boolean;
  historical?: boolean;
}) {
  const positive = record.reactions.filter((r) => r.after > r.before).length,
    negative = record.reactions.filter((r) => r.after < r.before).length;
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    resultHeading.current?.focus();
  }, [record.key]);
  return (
    <div className="media-result">
      <div className="media-complete">
        <Check size={24} />
        <div>
          <h3 ref={resultHeading} tabIndex={-1}>
            인터뷰와 팀 대화를 마쳤습니다
          </h3>
          <p>
            {record.summary} · {record.delegated || '감독 직접 참석'}
          </p>
        </div>
      </div>
      <div className="media-reaction-summary">
        <span>
          의욕·안정감 <b>{positive}명</b>
        </span>
        <span>
          부담 <b>{negative}명</b>
        </span>
        <span>
          차분한 반응 <b>{record.reactions.length - positive - negative}명</b>
        </span>
      </div>
      <h4>선수단의 반응</h4>
      <div className="media-reactions">
        {record.reactions.map((r) => (
          <div
            key={r.id}
            className={r.after > r.before ? 'positive' : r.after < r.before ? 'negative' : ''}
          >
            <strong>{r.name}</strong>
            <span>{r.reason}</span>
            <b>
              사기 {r.before.toFixed(1)} → {r.after.toFixed(1)}
            </b>
          </div>
        ))}
      </div>
      <button className="button primary" disabled={busy} onClick={onContinue}>
        {historical ? '현재 일정으로' : record.stage === 'pre' ? '경기장으로' : '다음 일정으로'}
        <ArrowRight size={16} />
      </button>
      <details className="media-transcript">
        <summary>질문과 답변 다시 읽기</summary>
        {record.questions.map((q) => (
          <div key={q.id}>
            <small>{q.speaker}</small>
            <h4>{q.text}</h4>
            <p>{record.answers.find((a) => a.id === q.id)?.text}</p>
          </div>
        ))}
      </details>
    </div>
  );
}
