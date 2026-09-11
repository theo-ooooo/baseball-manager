'use client';
import type { usePreviewSubstitution } from './use-preview-substitution';
import { battingLine } from './preview-substitution';

export function PreviewSubstitutionCard({
  coach,
  busy,
}: {
  coach: ReturnType<typeof usePreviewSubstitution>;
  busy: boolean;
}) {
  const suggestion = coach.recommendation;
  if (!suggestion) return null;
  return (
    <section className="coach-substitution-card" aria-label="경기 전 대타 제안">
      <small>
        {suggestion.coach} 코치 · 선발 교체 제안 ({suggestion.slot + 1}번 · {suggestion.position})
      </small>
      <small className="coach-judgment">{suggestion.judgment}</small>
      <strong>
        {suggestion.outgoing.name} → {suggestion.incoming.name}
      </strong>
      <p>{suggestion.reason}</p>
      <p>{suggestion.detail}</p>
      <p>
        {suggestion.outgoing.name} 시즌 {battingLine(suggestion.outgoing)}
      </p>
      <div>
        <button
          className="coach-substitution-apply"
          disabled={busy}
          onClick={() => void coach.apply()}
        >
          추천대로 교체
        </button>
        <button disabled={busy} onClick={coach.dismiss}>
          현재 선수 유지
        </button>
      </div>
    </section>
  );
}
