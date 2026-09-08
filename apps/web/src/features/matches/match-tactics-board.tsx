'use client';
import { Crosshair, Footprints, Scale, Eye, Check } from 'lucide-react';
import type { TeamInstructions } from '@dugout/shared/types';
import { defaults } from '@dugout/shared/management';

const presets = [
  { id: 'balanced', label: '균형', caption: '상황에 맞춰 유연하게', icon: Scale },
  { id: 'power', label: '장타 중심', caption: '큰 타구로 한 번에 득점', icon: Crosshair },
  { id: 'smallball', label: '기동력', caption: '적극적인 도루로 압박', icon: Footprints },
  { id: 'patient', label: '출루 중심', caption: '공을 고르며 기회 만들기', icon: Eye },
];
const instructions = [
  {
    key: 'steal',
    label: '주루',
    description: '도루 시도 성향',
    levels: ['신중하게', '상황에 맞게', '적극적으로'],
  },
  {
    key: 'patience',
    label: '타석 접근',
    description: '스윙과 선구안의 균형',
    levels: ['과감하게', '균형 있게', '기다리기'],
  },
  {
    key: 'power',
    label: '타격 방향',
    description: '정확성과 장타의 균형',
    levels: ['컨택 우선', '균형 있게', '장타 우선'],
  },
  {
    key: 'depth',
    label: '수비 위치',
    description: '타구에 대비하는 수비 깊이',
    levels: ['앞으로', '기본 위치', '뒤로'],
  },
] as const;
const levels = [20, 50, 85];
export function MatchTacticsBoard({
  value,
  onChange,
}: {
  value: TeamInstructions;
  onChange: (value: TeamInstructions) => void;
}) {
  const activePreset = presets.find((preset) => {
    const plan = defaults(preset.id);
    return instructions.every(({ key }) => plan[key] === value[key]);
  });
  return (
    <section className="plan-tactics" aria-label="팀 전술">
      <div className="plan-section-heading">
        <div>
          <span className="plan-eyebrow">감독의 게임 플랜</span>
          <h3>오늘은 어떤 야구를 할까요?</h3>
        </div>
        <span className="plan-tag">{activePreset?.label || '맞춤 전술'}</span>
      </div>
      <div className="plan-presets">
        {presets.map(({ id, label, caption, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={activePreset?.id === id}
            onClick={() => onChange(defaults(id))}
          >
            <Icon size={23} aria-hidden="true" />
            <strong>{label}</strong>
            <span>{caption}</span>
            {activePreset?.id === id && (
              <Check className="plan-preset-check" size={16} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div className="plan-instruction-grid">
        {instructions.map(({ key, label, description, levels: labels }) => (
          <div className="plan-instruction" key={key}>
            <div>
              <strong>{label}</strong>
              <small>{description}</small>
            </div>
            <div className="plan-segments" role="group" aria-label={label}>
              {labels.map((text, i) => (
                <button
                  key={text}
                  type="button"
                  aria-pressed={(value[key] < 34 ? 0 : value[key] < 67 ? 1 : 2) === i}
                  onClick={() => onChange({ ...value, [key]: levels[i] })}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="plan-fine-tune">
              <span>
                {label} 세부 조정 <b>{value[key]}</b>
              </span>
              <input
                type="range"
                aria-label={`${label} 세부 조정`}
                min="0"
                max="100"
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
              />
            </label>
          </div>
        ))}
      </div>
      <p className="plan-help">
        전술 카드를 고른 뒤 팀 지시를 세밀하게 조정할 수 있습니다. 수비 깊이는 왼쪽 구장에
        표시됩니다.
      </p>
    </section>
  );
}
