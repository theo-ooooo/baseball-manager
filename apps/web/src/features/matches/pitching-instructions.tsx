'use client';
import { pitchingApproaches, type PitchingApproach } from '@dugout/shared/pitching-tactics';

export function PitchingInstructions({
  value = 'balanced',
  onChange,
  disabled = false,
}: {
  value?: PitchingApproach;
  onChange: (value: PitchingApproach) => void;
  disabled?: boolean;
}) {
  return (
    <section className="pitching-instructions" aria-label="기본 투구 방침">
      <header>
        <div>
          <small>마운드의 게임 플랜</small>
          <h3>어떻게 승부할까요?</h3>
        </div>
        <span>우리 팀 투수 공통</span>
      </header>
      <div className="pitching-approach-cards">
        {(
          Object.entries(pitchingApproaches) as [
            PitchingApproach,
            (typeof pitchingApproaches)[PitchingApproach],
          ][]
        ).map(([key, plan]) => (
          <button
            type="button"
            key={key}
            aria-pressed={value === key}
            disabled={disabled}
            onClick={() => onChange(key)}
          >
            <strong>{plan.label}</strong>
            <span>{plan.benefit}</span>
            <small>{plan.cost}</small>
          </button>
        ))}
      </div>
      <p>
        제구와 경기 체력에 따라 효과가 달라집니다. 경기 중 작전 지시로 다음 타자만 다르게 상대할 수
        있습니다.
      </p>
    </section>
  );
}
