'use client';
import { managerOfferActionLabel } from './manager-offer-status';
import { useManagerInterview } from './use-manager-interview';
import { ManagerContractNegotiation } from './manager-contract-negotiation';
import Link from 'next/link';
import { Handshake, LockKeyhole, Megaphone, Mail } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { managerInterviewQuestions } from '@dugout/shared/manager-interview';
import { money } from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';
import { Badge } from '../../components/game-ui';
export function ManagerOfferCard({
  g,
  offer: o,
  act,
  busy,
  summary = false,
}: {
  g: GameState;
  offer: ManagerOffer;
  act: Act;
  busy: boolean;
  summary?: boolean;
}) {
  const { getClub } = useWorld();
  const club = getClub(o.club);
  const { selected, setSelected, answer } = useManagerInterview(act, busy);
  const expired = o.expires < gameDate(g),
    active = !expired && ['invited', 'pending', 'interview', 'offered'].includes(o.status);
  const questions = managerInterviewQuestions(g, o, club.name),
    question = questions[o.interview?.length || 0];
  const stage =
    o.status === 'invited'
      ? 0
      : o.status === 'interview'
        ? 1
        : o.status === 'offered'
          ? 3
          : o.answer
            ? 2
            : 0;
  return (
    <article className="manager-contact-card">
      <header>
        <Badge club={club} size="small" />
        <div>
          <small>{o.source === 'approach' ? '구단에서 먼저 보낸 연락' : '감독직 지원'}</small>
          <h3>{club.name}</h3>
        </div>
        <span className="contact-privacy">
          {o.public ? <Megaphone size={14} /> : <LockKeyhole size={14} />}{' '}
          {o.public ? '공개' : '비공개'}
        </span>
      </header>
      <ol className="contact-stages" aria-label="채용 진행">
        {['첫 연락', '면접', '최종 심사', '계약'].map((label, i) => (
          <li key={label} className={active && i <= stage ? 'reached' : ''}>
            {label}
          </li>
        ))}
      </ol>
      <div className="contact-letter">
        <Mail size={18} />
        <p>{expired ? '제안 유효기간이 지났습니다.' : o.message}</p>
      </div>
      <dl className="contact-terms">
        <div>
          <dt>시즌 기대</dt>
          <dd>{o.targetRank}위 이내</dd>
        </div>
        <div>
          <dt>제안 연봉</dt>
          <dd>{money(o.salary)}</dd>
        </div>
        <div>
          <dt>{o.status === 'pending' ? '다음 연락' : '답변 기한'}</dt>
          <dd>{o.status === 'pending' ? o.due : o.expires}</dd>
        </div>
      </dl>
      {!summary && o.status === 'invited' && !expired && (
        <div className="contact-actions">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act({ type: 'acceptManagerInvite', id: o.id })}
          >
            <Handshake size={16} />
            관심 있습니다 · 면접 수락
          </button>
          <small>수락하면 이사회와 운영 방향을 이야기합니다.</small>
        </div>
      )}
      {!summary && !!o.interview?.length && (
        <details className="interview-transcript">
          <summary>면접 대화 기록 · {o.interview.length}개 답변</summary>
          {o.interview.map((t, i) => (
            <div key={i}>
              <strong>{t.topic}</strong>
              <p>이사회 · {t.question}</p>
              <p>
                {g.manager} · {t.answer}
              </p>
              <small>{t.reaction}</small>
            </div>
          ))}
        </details>
      )}
      {!summary && o.status === 'interview' && !expired && question && (
        <div className="contact-interview">
          <div className="interview-topic">
            <span>감독 면접 · {question.topic}</span>
            <b>
              {(o.interview?.length || 0) + 1} / {questions.length}
            </b>
          </div>
          <h4>“{question.question}”</h4>
          <div className="interview-answers">
            {question.answers.map((a) => (
              <button
                key={a.id}
                disabled={busy}
                aria-pressed={selected === a.id}
                onClick={() => setSelected(a.id)}
              >
                <strong>{a.text}</strong>
              </button>
            ))}
          </div>
          <button
            className="button primary interview-submit"
            disabled={busy || !selected}
            onClick={() => void answer(o.id, question.id)}
          >
            {(o.interview?.length || 0) + 1 === questions.length
              ? '답변 전달 · 면접 마치기'
              : '답변 전달 · 대화 계속'}
          </button>
        </div>
      )}
      {!summary && o.status === 'interview' && !expired && !question && (
        <div className="contact-actions">
          <p>면접 답변을 모두 마쳤습니다. 최종 심사를 진행해 주세요.</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act({ type: 'finishManagerInterview', id: o.id })}
          >
            면접 마치기 · 최종 심사
          </button>
        </div>
      )}
      {!summary && o.status === 'offered' && !expired && (
        <ManagerContractNegotiation
          key={`${o.id}:${o.contractTerms?.version}`}
          g={g}
          offer={o}
          act={act}
          busy={busy}
        />
      )}
      {!summary && active && (
        <button
          className="text-button contact-decline"
          disabled={busy}
          onClick={() => void act({ type: 'declineManager', id: o.id })}
        >
          {o.status === 'invited'
            ? '제의는 감사하지만, 이번에는 사양하겠습니다.'
            : '이번 채용 절차에서 물러나겠습니다.'}
        </button>
      )}
      {summary && (
        <Link className="button primary" href={`/interviews/${encodeURIComponent(o.id)}`}>
          {managerOfferActionLabel(o, g)} →
        </Link>
      )}
    </article>
  );
}
