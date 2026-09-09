'use client';
import { useId } from 'react';

export function SalaryInput({
  value,
  onChange,
  disabled,
  label = '제안 연봉 (만 원)',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label?: string;
}) {
  const id = useId();
  const adjust = (factor: number) => {
    const current = Number(value);
    if (Number.isFinite(current))
      onChange(String(Math.min(140000000000, Math.max(1, Math.round(current * factor)))));
  };
  return (
    <div className="contract-salary-input">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="contract-number">
        <button
          type="button"
          aria-label={`${label} 5% 낮추기`}
          disabled={disabled}
          onClick={() => adjust(0.95)}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          min="1"
          max="140000000000"
          step="1"
          required
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={`${label} 5% 높이기`}
          disabled={disabled}
          onClick={() => adjust(1.05)}
        >
          +
        </button>
      </div>
      <small>만 원 / 시즌 · ±5% 조정</small>
    </div>
  );
}
