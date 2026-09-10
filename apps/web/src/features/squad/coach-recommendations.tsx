'use client';
import type { GameState } from '@dugout/shared/types';
import { squadMoveError } from '@dugout/shared/roster-rules';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
export function CoachRecommendations({
  g,
  act,
  busy,
  playerId,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  playerId?: string;
}) {
  const reports = (g.coachRecommendations || []).filter(
    (r) => r.status === 'pending' && (!playerId || r.playerId === playerId),
  );
  if (!reports.length) return null;
  return (
    <section className="panel panel-content">
      <h2>코치의 등록 제안</h2>
      {reports.map((r) => {
        const p = g.roster.find((p) => p.id === r.playerId),
          replacement = g.roster.find((p) => p.id === r.replacementId);
        const error =
          r.target === 'reserve' && r.reason.includes('컨디션')
            ? '이전 피로 보고입니다. 1군 소속을 유지하며 휴식을 주세요.'
            : daysBetween(r.date, gameDate(g)) > 14
              ? '보고 유효기간이 지났습니다.'
              : !p || (p.squad || 'first') === r.target
                ? '보고 이후 선수 등록이 변경됐습니다.'
                : squadMoveError(g, r.playerId, r.target, r.replacementId);
        return (
          <article className="manager-offer" key={r.id}>
            <h3>
              {p?.name || '소속 변경 선수'} ·{' '}
              {r.target === 'first' ? '1군 기용 추천' : '2군 재정비 추천'}
            </h3>
            <p>{r.reason}</p>
            <p>
              {r.date} 보고 · {replacement ? `${replacement.name}과 맞교체` : '등록 구분 변경'}
            </p>
            {error && <p className="muted">{error}</p>}
            <div className="manager-form">
              <button
                className="button primary"
                disabled={busy || !!error || !!g.liveMatch}
                onClick={() => void act({ type: 'coachRecommendation', id: r.id, accept: true })}
              >
                제안대로 등록 교체
              </button>
              <button
                className="button secondary"
                disabled={busy || !!g.liveMatch}
                onClick={() => void act({ type: 'coachRecommendation', id: r.id, accept: false })}
              >
                이번에는 보류
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
