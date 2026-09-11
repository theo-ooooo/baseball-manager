'use client';
import Link from 'next/link';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import type { GameState } from '@dugout/shared/types';
import { squadMoveError } from '@dugout/shared/roster-rules';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
export function CoachRecommendations({
  g,
  act,
  busy,
  playerId,
  compact = false,
  recommendationId,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  playerId?: string;
  compact?: boolean;
  recommendationId?: string;
}) {
  const reports = (g.coachRecommendations || []).filter((r) =>
    recommendationId
      ? r.id === recommendationId
      : r.status === 'pending' && (!playerId || r.playerId === playerId),
  );
  if (!reports.length || isClubSeasonRest(g) || g.managerCareer?.status === 'unemployed')
    return null;
  return (
    <section
      className={`coach-registration-proposals ${compact ? 'in-letter' : ''}`}
      aria-label="코치의 선수 등록 제안"
    >
      <header>
        <small>코치의 제안</small>
        <h2>이렇게 기회를 나눠보면 어떨까요?</h2>
        <p>이동할 선수를 살펴보고 결정해 주세요.</p>
      </header>
      {reports.map((r) => {
        const p = g.roster.find((p) => p.id === r.playerId),
          replacement = g.roster.find((p) => p.id === r.replacementId);
        const error =
          r.target === 'reserve' && !r.evidence && r.reason.includes('컨디션')
            ? '이전 피로 보고입니다. 1군 소속을 유지하며 휴식을 주세요.'
            : daysBetween(r.date, gameDate(g)) > 14
              ? '보고 유효기간이 지났습니다.'
              : !p || (p.squad || 'first') === r.target
                ? '보고 이후 선수 등록이 변경됐습니다.'
                : squadMoveError(g, r.playerId, r.target, r.replacementId);
        return (
          <article className="coach-registration-card" key={r.id}>
            <div className="coach-registration-pair">
              <div className={r.target === 'first' ? 'promotion' : 'demotion'}>
                <small>
                  {r.target === 'first' ? '1군으로 올릴 선수' : '2군에서 재정비할 선수'}
                </small>
                <Link href={`/players/${encodeURIComponent(r.playerId)}`}>
                  {p?.name || '소속이 바뀐 선수'}
                </Link>
                <span>{r.target === 'first' ? '2군 → 1군' : '1군 → 2군'}</span>
              </div>
              {replacement && (
                <div className={r.target === 'first' ? 'demotion' : 'promotion'}>
                  <small>{r.target === 'first' ? '대신 2군으로 이동' : '대신 1군으로 합류'}</small>
                  <Link href={`/players/${encodeURIComponent(replacement.id)}`}>
                    {replacement.name}
                  </Link>
                  <span>{r.target === 'first' ? '1군 → 2군' : '2군 → 1군'}</span>
                </div>
              )}
            </div>
            {!compact && <p>{r.reason}</p>}
            {!compact && r.evidence && (
              <div className="coach-evidence">
                <strong>
                  {r.evidence.category === 'performance'
                    ? '성적 부진에 따른 재정비'
                    : '2군 성적과 등록 경쟁에 따른 추천'}
                </strong>
                <dl>
                  <div>
                    <dt>평가한 기록</dt>
                    <dd>{r.evidence.stats}</dd>
                  </div>
                  <div>
                    <dt>권고 기준</dt>
                    <dd>{r.evidence.threshold}</dd>
                  </div>
                  <div>
                    <dt>보고 당시 컨디션</dt>
                    <dd>{r.evidence.condition}% · 휴식 필요 여부는 별도 판단</dd>
                  </div>
                </dl>
                {r.evidence.replacementReason && <p>{r.evidence.replacementReason}</p>}
              </div>
            )}
            <p className="coach-registration-date">
              {r.date} 제안{!replacement && ' · 빈 등록 자리 활용'}
            </p>
            {r.status === 'pending' && error && (
              <p className="coach-registration-notice">{error}</p>
            )}
            {r.status !== 'pending' && (
              <p className="coach-registration-notice">
                {r.status === 'accepted'
                  ? '추천대로 등록을 바꿨습니다.'
                  : '이번 제안은 보류했습니다.'}
              </p>
            )}
            {r.status === 'pending' && (
              <div className="coach-registration-actions">
                <button
                  className="button primary"
                  disabled={busy || !!error || !!g.liveMatch}
                  onClick={() => void act({ type: 'coachRecommendation', id: r.id, accept: true })}
                >
                  추천대로 교체
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !!g.liveMatch}
                  onClick={() => void act({ type: 'coachRecommendation', id: r.id, accept: false })}
                >
                  이번에는 보류
                </button>
              </div>
            )}
            <Link className="coach-registration-review" href="/?view=reserves">
              선수단에서 자세히 검토 →
            </Link>
          </article>
        );
      })}
    </section>
  );
}
