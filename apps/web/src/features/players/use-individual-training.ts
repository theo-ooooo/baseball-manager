'use client';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { AbilityKey, GameState, Player } from '@dugout/shared/types';
import type { TrainingFocus, TrainingPlan } from '@dugout/shared/training-plan';
import { availableMentors } from '@dugout/shared/training-plan';
import { detailedAttributes } from '@dugout/shared/player-attributes';
import type { Act } from '../career/game-contracts';

export function useIndividualTraining(g: GameState, p: Player, act: Act) {
  const current = p.trainingPlan;
  const [focus, setFocus] = useState<TrainingFocus>(current?.focus || 'balanced'),
    [intensity, setIntensity] = useState<TrainingPlan['intensity']>(current?.intensity || 'normal'),
    [restDays, setRestDays] = useState(current?.restDays || []),
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = await act({
      type: 'setTrainingPlan',
      id: p.id,
      focus,
      intensity,
      restDays,
      mentorId: mentorId || undefined,
      target: target ? Number(target) : undefined,
    });
    if (next) toast.success('개인 육성 계획을 저장했습니다. 날짜를 진행하면 훈련에 반영됩니다.');
  };
  return {
    current,
    focus,
    setFocus,
    intensity,
    setIntensity,
    restDays,
    setRestDays,
    mentorId,
    setMentorId,
    target,
    setTarget,
    keys,
    observed,
    focused,
    mentors,
    goal,
    progress,
    submit,
    clear: () => void act({ type: 'clearTrainingPlan', id: p.id }),
  };
}
