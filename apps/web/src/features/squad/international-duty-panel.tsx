'use client';
import Link from 'next/link';
import { Globe2, ArrowUpRight } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useInternationalDuty } from './use-international-duty';

export function InternationalDutyPanel({
  g,
  act,
  busy,
  eventId,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  eventId?: string;
}) {
  const duty = useInternationalDuty(g, act, busy, eventId);
  if (!duty.rows.length) return null;
  return (
    <section className="international-duty" aria-label="국가대표 차출 선수">
      <header>
        <Globe2 size={20} />
        <div>
          <h3>국가대표 차출</h3>
          <p>합류 기간에는 구단 경기·훈련에 참가하지 않습니다.</p>
        </div>
        <span>{duty.rows.length}명</span>
      </header>
      <div className="international-duty-list">
        {duty.rows.map(({ event, player, replacement }) => (
          <article key={`${event.id}:${player.id}`}>
            <div>
              <span className="international-status">
                {event.stage === 'away'
                  ? '대표팀 합류 중'
                  : event.stage === 'returned'
                    ? '구단 복귀'
                    : '차출 예정'}
              </span>
              <h4>
                <Link href={`/players/${encodeURIComponent(player.id)}`}>{player.name}</Link>
                <small>{player.country} 대표</small>
              </h4>
              <p>
                {event.name} · {event.departure} 합류 / {event.returnDate} 복귀
              </p>
            </div>
            {event.stage === 'away' && (
              <div className="international-replacement">
                {replacement ? (
                  <>
                    <strong>{replacement.name} 1군 등록 추천</strong>
                    <p>
                      같은 포지션 · 컨디션 {Math.round(replacement.condition)}% · {player.name}와
                      등록 맞교체
                    </p>
                    <button
                      className="button primary compact"
                      disabled={duty.disabled}
                      onClick={() => void duty.replace(player.id, replacement.id)}
                    >
                      대체 선수 등록 <ArrowUpRight size={15} />
                    </button>
                    <small>일반 말소·재등록 대기 규정이 적용됩니다.</small>
                  </>
                ) : (
                  <p>
                    {player.squad === 'reserve'
                      ? '2군 등록 상태 · 복귀를 기다립니다.'
                      : '등록 조건을 만족하는 같은 포지션의 2군 선수가 없습니다. 남아 있는 1군 선수를 기용해 주세요.'}
                  </p>
                )}
              </div>
            )}
            {event.stage === 'returned' && (
              <p>
                컨디션 {Math.round(player.condition)}% ·{' '}
                {player.squad === 'reserve' ? '2군' : '1군'} 등록 상태
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
