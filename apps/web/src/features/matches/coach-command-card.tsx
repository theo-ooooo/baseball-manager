import type { coachMatchCommand } from './coach-match-command';

export function CoachCommandCard({
  advice,
  busy,
  onSelect,
  label = '추천 작전 검토',
}: {
  advice: ReturnType<typeof coachMatchCommand>;
  busy: boolean;
  onSelect: () => void;
  label?: string;
}) {
  if (!advice) return null;
  return (
    <section
      className="coach-substitution-card coach-command-advice"
      aria-label={`${advice.role} 코치 작전 추천`}
    >
      <small>
        {advice.coach} · {advice.role} 코치
      </small>
      <strong>
        {advice.player} · {advice.label} 추천
      </strong>
      <small className="coach-command-profile">{advice.profile}</small>
      <p>{advice.reason}</p>
      <button disabled={busy} onClick={onSelect}>
        {label}
      </button>
    </section>
  );
}
