import type { GameState, NegotiationRound, NegotiationStatus } from '@dugout/shared/types';
import { dateLabel } from '@dugout/shared/calendar';
import { money } from '@dugout/shared/game-view';

export const negotiationLabels: Record<NegotiationStatus, string> = {
  pending: '답변 대기',
  accepted: '조건 합의',
  counter: '역제안 도착',
  rejected: '제안 거절',
  withdrawn: '협상 철회',
  expired: '제안 만료',
};
export function NegotiationHistory({ history, g }: { history?: NegotiationRound[]; g: GameState }) {
  if (!history?.length) return null;
  return (
    <details className="negotiation-history">
      <summary>협상 경과 · {history.length}건</summary>
      <ol>
        {history.map((r, i) => (
          <li key={i}>
            <small>
              {r.year} · {dateLabel(g, r.day)} · {money(r.salary)} / {r.years}년
            </small>
            <p>{r.message}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
