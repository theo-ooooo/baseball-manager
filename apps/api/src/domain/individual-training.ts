import type { AbilityKey, GameState, Player } from '@dugout/shared/types';
import type { TrainingFocus, TrainingPlan } from '@dugout/shared/training-plan';
import { availableMentors, trainingRest } from '@dugout/shared/training-plan';
import { abilityKeys, abilityLabels } from '@dugout/shared/development';
import { gameDate } from '@dugout/shared/calendar';
import { detailedAttributes } from '@dugout/shared/player-attributes';
import { postNews } from './club-dynamics';

export function individualTrainingAction(
  g: GameState,
  a: Record<string, unknown>,
): GameState | null {
  if (a.type !== 'setTrainingPlan' && a.type !== 'clearTrainingPlan') return null;
  if (g.liveMatch) throw new Error('개인 훈련은 진행 중인 경기를 마친 뒤 변경해 주세요.');
  const p = g.roster.find((p) => p.id === a.id);
  if (!p) throw new Error('육성할 소속 선수를 선택해 주세요.');
  if (a.type === 'clearTrainingPlan') {
    delete p.trainingPlan;
    return g;
  }
  const focus = String(a.focus),
    intensity = String(a.intensity),
    restDays = a.restDays;
  const validKeys =
    p.pos === 'P' ? ['stuff', 'control', 'field', 'speed'] : ['contact', 'power', 'field', 'speed'];
  if (
    !['balanced', 'rest', ...validKeys].includes(focus) ||
    !['light', 'normal', 'intense'].includes(intensity)
  )
    throw new Error('선수에게 맞는 목표 능력과 훈련 강도를 선택해 주세요.');
  if (
    !Array.isArray(restDays) ||
    restDays.length > 7 ||
    restDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(restDays).size !== restDays.length
  )
    throw new Error('휴식 요일을 확인해 주세요.');
  const mentorId = a.mentorId ? String(a.mentorId) : undefined;
  if (mentorId) {
    if (!availableMentors(g, p).some((m) => m.id === mentorId))
      throw new Error(
        '같은 투타 구분의 26세 이상, 세 살 이상 연상의 소속 선수를 멘토로 선택해 주세요.',
      );
    if (g.roster.filter((m) => m.id !== p.id && m.trainingPlan?.mentorId === mentorId).length >= 3)
      throw new Error('한 멘토는 최대 세 명을 지도할 수 있습니다.');
  }
  const ability = abilityKeys.includes(focus as AbilityKey) ? (focus as AbilityKey) : undefined;
  const target = a.target === undefined || a.target === null ? undefined : Number(a.target);
  if (
    target !== undefined &&
    (!ability ||
      !Number.isFinite(target) ||
      target <= p[ability] ||
      target > 99 ||
      !detailedAttributes(p).some((a) => a.key === ability && a.value !== null))
  )
    throw new Error('평가된 능력의 현재 수치보다 높고 99 이하인 목표를 입력해 주세요.');
  p.trainingPlan = {
    focus: focus as TrainingFocus,
    intensity: intensity as TrainingPlan['intensity'],
    restDays: [...restDays].sort(),
    mentorId,
    target,
    baseline: ability ? p[ability] : undefined,
    started: gameDate(g),
  };
  return g;
}
const neutralFactors = Object.fromEntries(abilityKeys.map((key) => [key, 1])) as Record<
  AbilityKey,
  number
>;
export function individualTrainingFactors(g: GameState, p: Player, loadHandled = false) {
  const plan = p.trainingPlan;
  if (!plan) return neutralFactors;
  const resting = !loadHandled && trainingRest(g, p);
  const intensity =
    plan.intensity === 'light'
      ? 0.65
      : plan.intensity === 'intense'
        ? p.condition >= 65
          ? 1.25
          : 0.55
        : 1;
  const mentor = plan.mentorId
    ? availableMentors(g, p).find((m) => m.id === plan.mentorId)
    : undefined;
  return Object.fromEntries(
    abilityKeys.map((key) => {
      const focus = plan.focus === 'balanced' ? 1 : plan.focus === key ? 1.5 : 0.85;
      const mentoring =
        mentor && mentor[key] > p[key] && (mentor.mood?.value ?? 65) >= 45 ? 1.08 : 1;
      return [
        key,
        loadHandled ? focus * mentoring : resting ? 0.12 : intensity * focus * mentoring,
      ];
    }),
  ) as Record<AbilityKey, number>;
}
export function checkTrainingGoal(g: GameState, p: Player) {
  const plan = p.trainingPlan;
  if (
    !plan ||
    plan.achieved ||
    plan.target === undefined ||
    !abilityKeys.includes(plan.focus as AbilityKey)
  )
    return;
  const key = plan.focus as AbilityKey;
  if (p[key] < plan.target) return;
  plan.achieved = gameDate(g);
  postNews(
    g,
    `${p.name} · 개인 육성 목표 달성`,
    `${abilityLabels[key]} ${plan.baseline?.toFixed(2)} → ${p[key].toFixed(2)}. 목표 ${plan.target.toFixed(2)}에 도달했습니다. 새 목표나 훈련 강도를 검토해 주세요.`,
    'development',
    {
      playerId: p.id,
      actionView: 'squad',
      sender: { name: '육성 담당 코치', role: '개인 훈련 점검' },
      report: {
        facts: [
          { label: '목표 능력', value: abilityLabels[key] },
          { label: '현재 능력', value: p[key].toFixed(2) },
          { label: '시작일', value: plan.started },
        ],
        sections: [
          {
            title: '다음 육성 계획',
            body: '선수 상세의 성장 기록에서 다음 목표를 지정하거나 훈련 강도를 조정하세요. 목표를 달성한 뒤에도 지정한 훈련은 계속됩니다.',
          },
        ],
      },
    },
  );
}
