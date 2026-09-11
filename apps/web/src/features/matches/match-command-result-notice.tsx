'use client';
import { Sparkles, X } from 'lucide-react';
import type { MatchCommandResult } from './match-command-results';

export function MatchCommandResultNotice({
  event,
  onDismiss,
}: {
  event?: MatchCommandResult;
  onDismiss: () => void;
}) {
  if (!event) return null;
  return (
    <section
      key={event.id}
      className={`match-command-result ${event.success ? 'is-success' : ''} ${event.homeRun ? 'is-homerun' : ''}`}
      role="status"
      aria-label="사인 실행 결과"
    >
      <div>
        <small>
          {event.inning}회 {event.half ? '말' : '초'} · {event.player} · {event.command}
        </small>
        <strong>
          {event.success && <Sparkles size={20} aria-hidden="true" />}
          {event.success ? '작전 성공!' : '사인 결과'}
        </strong>
        {event.detail && <p>{event.detail}</p>}
      </div>
      <b className="match-command-result-label">{event.label}</b>
      <button aria-label="사인 결과 닫기" onClick={onDismiss}>
        <X size={18} />
      </button>
    </section>
  );
}

export function MatchCommandResultHistory({ events }: { events: MatchCommandResult[] }) {
  if (!events.length) return null;
  return (
    <details className="match-substitution-history match-command-result-history" open>
      <summary>
        내 사인 결과 <b>{events.length}</b>
      </summary>
      <ol>
        {events.toReversed().map((event) => (
          <li key={event.id} className={event.success ? 'is-success' : ''}>
            <small>
              {event.inning}회 {event.half ? '말' : '초'} · {event.player} · {event.command}
            </small>
            <strong>
              {event.success ? '작전 성공! · ' : ''}
              {event.label}
            </strong>
            {event.detail && <p>{event.detail}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
