'use client';
import {
  useMatchConversation,
  useConversationForm,
  useConversationFocus,
} from './use-match-conversation';
import { Check, Mic, Users, ArrowRight } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { type MatchConversation, type ConversationRecord } from '@dugout/shared/match-media';
import type { Act } from '../career/game-contracts';
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
  const { context, selected, setSelected, journal, prior, completed, getClub } =
    useMatchConversation(g);
  return (
    <div className="match-media-page">
      <section
        className={`media-room ${!completed && context?.questions[0].room === 'team' ? 'locker-room' : ''}`}
      >
        <header className="media-room-header">
          <ClubBadge club={getClub(g.club)} size="small" />
          <div>
            <span>MEDIA ROOM · CLUBHOUSE</span>
            <h2>{context?.stage === 'post' ? '경기 후 기자회견' : '경기 전 기자회견'}</h2>
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
        <details className="media-journal">
          <summary>지난 발언과 선수 반응 · {journal.length}건</summary>
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
        </details>
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
  const f = useConversationForm(context, act, busy);
  const { at, setAt, answers, selected, last, question, questionHeading } = f;
  const coach = g.staff.find((c) => c.role === '수석') || g.staff[0];
  return (
    <form
      className={`media-conversation ${question.room === 'team' ? 'is-team-talk' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        await f.submit();
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
      <div className="media-dialogue-grid">
        <section className="media-question" aria-live="polite">
          <div className="media-speaker">
            <span>{question.room === 'press' ? <Mic size={22} /> : <Users size={22} />}</span>
            <div>
              <small>
                {question.room === 'press' ? '기자의 질문' : '선수단을 향한 메시지'} · {at + 1}/
                {context.questions.length}
              </small>
              <strong>{question.speaker}</strong>
            </div>
          </div>
          <h3 ref={questionHeading} tabIndex={-1}>
            {question.text}
          </h3>
          <p className="media-question-hint">
            {question.room === 'press'
              ? '어떤 태도로 답변할지 선택하세요.'
              : '경기 상황과 선수들의 사기를 생각하며 말해 주세요.'}
          </p>
        </section>
        <fieldset className="media-answers" disabled={busy}>
          <legend>어떻게 답하시겠습니까?</legend>
          {question.choices.map((choice, index) => (
            <label key={choice.id} className={selected === choice.id ? 'is-selected' : ''}>
              <input
                type="radio"
                name={question.id}
                value={choice.id}
                checked={selected === choice.id}
                onChange={() => f.choose(choice.id)}
              />
              <b className="media-answer-number" aria-hidden="true">
                {index + 1}
              </b>
              <span>
                <small>{choice.tone}</small>
                <strong>{choice.text}</strong>
              </span>
              {selected === choice.id && <Check size={19} />}
            </label>
          ))}
        </fieldset>
      </div>
      {selected && (
        <div className="media-answer-preview">
          <small>선택한 답변 · 아직 전달 전</small>
          <p>“{question.choices.find((c) => c.id === selected)?.text}”</p>
        </div>
      )}
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
          {busy ? '메시지 전달 중…' : last ? '답변 확정 · 선수단에 전달' : '이 답변으로 다음 질문'}
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
          onClick={() => {
            if (!busy && coach) void f.delegate();
          }}
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
  const resultHeading = useConversationFocus(record.key);
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
      <button className="button primary" disabled={busy} onClick={onContinue}>
        {historical ? '현재 일정으로' : record.stage === 'pre' ? '경기장으로' : '다음 일정으로'}
        <ArrowRight size={16} />
      </button>
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
