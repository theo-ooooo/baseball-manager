'use client';
import { ArrowRightLeft, X } from 'lucide-react';
import type { MatchSubstitution } from './match-substitutions';

export function MatchSubstitutionNotice({
  event,
  onDismiss,
}: {
  event?: MatchSubstitution;
  onDismiss: () => void;
}) {
  if (!event) return null;
  return (
    <section className="match-substitution-notice" role="status" aria-label="자동 투수 교체 알림">
      <ArrowRightLeft size={18} aria-hidden="true" />
      <div>
        <small>
          {event.inning}회 {event.half ? '말' : '초'} ·{' '}
          {event.own ? '우리 팀 자동 교체' : '상대 팀 투수 교체'}
        </small>
        <strong>
          {event.from} <span aria-label="교체">→</span> {event.to}
          {event.role && <em>{event.role}</em>}
        </strong>
        <p>{event.reason}</p>
      </div>
      <button aria-label="교체 알림 닫기" onClick={onDismiss}>
        <X size={17} />
      </button>
    </section>
  );
}

export function MatchSubstitutionHistory({ events }: { events: MatchSubstitution[] }) {
  if (!events.length) return null;
  return (
    <details className="match-substitution-history">
      <summary>
        자동 투수 교체 기록 <b>{events.length}</b>
      </summary>
      <ol>
        {events.toReversed().map((event) => (
          <li key={event.id}>
            <small>
              {event.inning}회 {event.half ? '말' : '초'} · {event.own ? '우리 팀' : '상대 팀'}
            </small>
            <strong>
              {event.from} → {event.to}
            </strong>
            <p>{event.reason}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
