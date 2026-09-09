'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AbilityKey, GameState, Player } from '@dugout/shared/types';
import type { TrainingFocus, TrainingPlan } from '@dugout/shared/training-plan';
import { availableMentors, intensityLabels, trainingWeek } from '@dugout/shared/training-plan';
import { abilityLabels } from '@dugout/shared/development';
import { detailedAttributes } from '@dugout/shared/player-attributes';
import { Progress } from '@/components/ui/progress';
import type { Act } from '../career/game-contracts';

export function TrainingPlanForm({
  player: p,
  g,
  act,
  busy,
}: {
  player: Player;
  g: GameState;
  act: Act;
  busy: boolean;
}) {
  const current = p.trainingPlan;
  const [focus, setFocus] = useState<TrainingFocus>(current?.focus || 'balanced'),
    [intensity, setIntensity] = useState<TrainingPlan['intensity']>(current?.intensity || 'normal'),
    [restDays, setRestDays] = useState(current?.restDays || [1]),
    [mentorId, setMentorId] = useState(current?.mentorId || ''),
    [target, setTarget] = useState(
      current?.target !== undefined && !current.achieved ? String(current.target) : '',
    );
  const keys = (
    p.pos === 'P' ? ['stuff', 'control', 'field', 'speed'] : ['contact', 'power', 'field', 'speed']
  ) as AbilityKey[];
  const observed = new Set(
    detailedAttributes(p)
      .filter((a) => a.value !== null)
      .map((a) => a.key),
  );
  const focused = keys.includes(focus as AbilityKey) ? (focus as AbilityKey) : undefined;
  const mentors = availableMentors(g, p);
  const goal =
    current?.target !== undefined &&
    current.baseline !== undefined &&
    keys.includes(current.focus as AbilityKey)
      ? {
          current: p[current.focus as AbilityKey],
          baseline: current.baseline,
          target: current.target,
        }
      : null;
  const progress =
    goal && goal.target > goal.baseline
      ? Math.max(
          0,
          Math.min(100, ((goal.current - goal.baseline) / (goal.target - goal.baseline)) * 100),
        )
      : 0;
  return (
    <section className="individual-training-plan">
      <header>
        <div>
          <small>개인 육성</small>
          <h3>다음 성장을 설계하세요</h3>
        </div>
        <span className="pill">
          {current?.achieved ? '목표 달성' : current ? '개인 계획 적용 중' : '팀 훈련 적용 중'}
        </span>
      </header>
      {goal && (
        <div className="individual-goal">
          <strong>
            {abilityLabels[current!.focus as AbilityKey]} {goal.baseline.toFixed(2)} →{' '}
            {goal.target.toFixed(2)}
          </strong>
          <span>
            현재 {goal.current.toFixed(2)}
            {current?.achieved ? ` · ${current.achieved} 달성` : ''}
          </span>
          <Progress value={progress} aria-label="개인 육성 목표 진척" />
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const next = await act({
            type: 'setTrainingPlan',
            id: p.id,
            focus,
            intensity,
            restDays,
            mentorId: mentorId || undefined,
            target: target ? Number(target) : undefined,
          });
          if (next)
            toast.success('개인 육성 계획을 저장했습니다. 날짜를 진행하면 훈련에 반영됩니다.');
        }}
      >
        <fieldset disabled={busy}>
          <legend>집중할 능력</legend>
          <div className="training-focus-options">
            {(['balanced', ...keys, 'rest'] as TrainingFocus[]).map((key) => (
              <button
                type="button"
                key={key}
                aria-pressed={focus === key}
                onClick={() => {
                  setFocus(key);
                  setTarget('');
                }}
              >
                <strong>
                  {key === 'balanced'
                    ? '균형 육성'
                    : key === 'rest'
                      ? '회복 집중'
                      : abilityLabels[key]}
                </strong>
                <small>
                  {key === 'balanced'
                    ? '전반적 능력'
                    : key === 'rest'
                      ? '훈련 부담 완화'
                      : observed.has(key)
                        ? `현재 ${p[key].toFixed(2)}`
                        : '게임 훈련 · 수치 미평가'}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="training-plan-fields">
          <fieldset disabled={busy}>
            <legend>훈련 강도</legend>
            <div className="contract-year-options">
              {Object.entries(intensityLabels).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={intensity === value}
                  onClick={() => setIntensity(value as TrainingPlan['intensity'])}
                >
                  {label}
                </button>
              ))}
            </div>
            <small>강한 훈련은 피로 부담이 커집니다. 컨디션이 낮으면 효과가 줄어듭니다.</small>
          </fieldset>
          <label>
            목표 수치 (선택)
            <input
              aria-label="개인 육성 목표 수치"
              type="number"
              step="0.01"
              min={focused ? (Math.floor(p[focused] * 100) + 1) / 100 : 0}
              max="99"
              disabled={busy || !focused || !observed.has(focused)}
              placeholder={focused && observed.has(focused) ? '예: 70' : '능력을 선택하세요'}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <small>도달하면 성장 보고로 알려드립니다.</small>
          </label>
        </div>
        <fieldset disabled={busy}>
          <legend>매주 훈련을 쉬는 날</legend>
          <div className="training-rest-days">
            {trainingWeek.map(({ day, label }) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={restDays.includes(day)}
                  onChange={(e) =>
                    setRestDays((days) =>
                      e.target.checked ? [...days, day] : days.filter((d) => d !== day),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <small>
            지정한 요일에는 훈련을 줄이고 회복합니다. 경기 출전 명단은 감독이 별도로 관리합니다.
          </small>
        </fieldset>
        <label className="training-mentor">
          함께 훈련할 멘토
          <select disabled={busy} value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
            <option value="">멘토 없이 훈련</option>
            {mentors.map((m) => {
              const count = g.roster.filter(
                (x) => x.id !== p.id && x.trainingPlan?.mentorId === m.id,
              ).length;
              return (
                <option key={m.id} value={m.id} disabled={count >= 3}>
                  {m.name} · {m.age}세 · {count}/3명 지도
                </option>
              );
            })}
          </select>
          <small>
            같은 투타 구분, 26세 이상이며 세 살 이상 연상의 선수입니다. 멘토의 강점과 사기가 훈련
            효과에 영향을 줍니다.
          </small>
        </label>
        <div className="scout-toolbar">
          <button className="button primary" disabled={busy}>
            {busy ? '저장 중…' : '육성 계획 적용'}
          </button>
          {current && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void act({ type: 'clearTrainingPlan', id: p.id })}
            >
              팀 훈련으로 복귀
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
