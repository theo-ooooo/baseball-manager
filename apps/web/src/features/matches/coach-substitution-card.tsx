'use client';
import type { useCoachSubstitution } from './use-coach-substitution';

export function CoachSubstitutionCard({
  coach,
  busy,
}: {
  coach: ReturnType<typeof useCoachSubstitution>;
  busy: boolean;
}) {
  const suggestion = coach.recommendation;
  if (!suggestion) return null;
  return (
    <section className="coach-substitution-card" aria-label="코치 교체 제안">
      <small>
        {suggestion.coach} 코치 · {suggestion.kind === 'pitcher' ? '투수 교체 제안' : '대타 제안'}
      </small>
      <small className="coach-judgment">{suggestion.judgment}</small>
      <strong>
        {suggestion.outgoing.name} → {suggestion.incoming.name}
      </strong>
      <p>{suggestion.reason}</p>
      {suggestion.preparation && (
        <p className={suggestion.emergency ? 'needs-warmup' : ''}>
          {suggestion.preparation}
          {suggestion.emergency ? ' · 지금 긴급 투입하면 경기 체력 12 감소' : ''}
        </p>
      )}
      <div>
        {suggestion.canWarm && (
          <button disabled={busy} onClick={() => void coach.warm()}>
            몸풀기 시작
          </button>
        )}
        <button
          className="coach-substitution-apply"
          disabled={busy}
          onClick={() => void coach.apply()}
        >
          {suggestion.emergency ? '긴급 교체 · 경기 재개' : '추천대로 교체 · 경기 재개'}
        </button>
        <button disabled={busy} onClick={coach.dismiss}>
          현재 선수 유지
        </button>
      </div>
    </section>
  );
}
