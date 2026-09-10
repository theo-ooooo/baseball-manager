'use client';
import { ManagerContractNegotiation } from './manager-contract-negotiation';
import { gameDate } from '@dugout/shared/calendar';
import { managerOfferActionLabel } from './manager-offer-status';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { managerInterviewQuestions } from '@dugout/shared/manager-interview';
import { useWorld } from './world-context';
import { Badge } from '../../components/game-ui';
import { ManagerOfferCard } from './manager-offer-card';
import type { Act } from './game-contracts';
export function ManagerInterviewSession({
  g,
  offer,
  act,
  busy,
}: {
  g: GameState;
  offer: ManagerOffer;
  act: Act;
  busy: boolean;
}) {
  const { getClub } = useWorld(),
    club = getClub(offer.club),
    questions = managerInterviewQuestions(g, offer, club.name),
    answered = offer.interview?.length || 0;
  return (
    <div className="manager-interview-session">
      <Link className="text-button" href="/manager/offers">
        ← 받은 제안으로
      </Link>
      <header className="interview-session-header">
        <Badge club={club} size="large" />
        <div>
          <small>MANAGER RECRUITMENT · {offer.public ? '공개 지원' : '비공개 접촉'}</small>
          <h2>
            {club.name} · {managerOfferActionLabel(offer, g)}
          </h2>
          <p>{g.manager} 감독의 면접 답변과 계약 조건을 논의합니다.</p>
        </div>
        <Link className="button secondary" href={`/clubs/${encodeURIComponent(club.id)}`}>
          구단 살펴보기
        </Link>
      </header>
      {offer.status === 'offered' && offer.expires >= gameDate(g) ? (
        <ManagerContractNegotiation
          key={`${offer.id}:${offer.contractTerms?.version}`}
          g={g}
          offer={offer}
          act={act}
          busy={busy}
        />
      ) : (
        <div className="interview-session-layout">
          <aside className="interview-agenda">
            <span>감독 선임 절차</span>
            <ol>
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className={
                    i === answered && offer.status === 'interview'
                      ? 'current'
                      : i < answered
                        ? 'done'
                        : ''
                  }
                >
                  <span>{i < answered ? <Check size={14} /> : i + 1}</span>
                  <div>
                    <strong>{q.topic}</strong>
                    <small>
                      {i < answered
                        ? '대화 완료'
                        : i === answered && offer.status === 'interview'
                          ? '논의 중'
                          : '예정'}
                    </small>
                  </div>
                </li>
              ))}
              <li className={offer.status === 'offered' ? 'current' : ''}>
                <span>✓</span>
                <div>
                  <strong>고용 계약 협상</strong>
                  <small>최종 선임 제안 후</small>
                </div>
              </li>
            </ol>
          </aside>
          <main>
            <ManagerOfferCard g={g} offer={offer} act={act} busy={busy} />
          </main>
        </div>
      )}
    </div>
  );
}
