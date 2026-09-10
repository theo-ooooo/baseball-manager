import { isClubSeasonRest } from './season-status';
import type { AbilityKey, GameState, Player } from './types';
import { addDays } from './calendar';
import { isAvailable } from './long-term';

export type TrainingSquad = 'first' | 'reserve';
export type TrainingDiscipline = 'batting' | 'pitching' | 'defense' | 'fitness';
export const trainingDisciplines: Record<TrainingDiscipline, string> = {
  batting: '타격',
  pitching: '투수',
  defense: '수비',
  fitness: '체력',
};
export const trainingSessions = {
  general: {
    label: '종합 훈련',
    detail: '투수와 야수가 각자의 기본기를 고르게 훈련합니다.',
    load: 1,
    recovery: 0,
    group: 'general',
  },
  batting: {
    label: '타격 · 선구안',
    detail: '야수는 컨택과 선구안, 투수는 가벼운 제구 훈련을 합니다.',
    load: 1,
    recovery: 0,
    group: 'batting',
  },
  power: {
    label: '장타 훈련',
    detail: '야수의 장타 능력에 집중합니다. 일반 타격 훈련보다 부담이 큽니다.',
    load: 1.3,
    recovery: 0,
    group: 'batting',
  },
  pitching: {
    label: '불펜 피칭',
    detail: '투수의 구위와 제구를 훈련합니다. 야수는 수비 기본기를 훈련합니다.',
    load: 1.25,
    recovery: 0,
    group: 'pitching',
  },
  control: {
    label: '제구 훈련',
    detail: '투수의 제구에 집중하며 야수는 타격 기본기를 유지합니다.',
    load: 1,
    recovery: 0,
    group: 'pitching',
  },
  defense: {
    label: '수비 합동 훈련',
    detail: '수비 능력과 포지션 숙련도를 높입니다.',
    load: 0.9,
    recovery: 0,
    group: 'defense',
  },
  physical: {
    label: '체력 · 주루',
    detail: '주력과 신체 능력을 훈련합니다. 높은 강도로 피로가 누적될 수 있습니다.',
    load: 1.7,
    recovery: 0,
    group: 'fitness',
  },
  tactics: {
    label: '경기 계획 · 분석',
    detail: '전술 숙련도를 높이고 다음 경기의 움직임을 준비합니다.',
    load: 0.35,
    recovery: 0,
    group: 'tactics',
  },
  recovery: {
    label: '회복 · 정리 운동',
    detail: '부담을 낮추고 컨디션 회복을 돕습니다. 능력 훈련은 하지 않습니다.',
    load: 0.15,
    recovery: 3,
    group: 'recovery',
  },
  rest: {
    label: '휴식',
    detail: '단체 훈련 없이 휴식합니다. 훈련으로 능력이 오르지는 않습니다.',
    load: 0,
    recovery: 4,
    group: 'rest',
  },
  match: {
    label: '경기',
    detail: '실제 경기 일정에 따라 확보되는 시간입니다. 훈련으로 바꿀 수 없습니다.',
    load: 0,
    recovery: 0,
    group: 'match',
  },
} as const;
export type TrainingSession = keyof typeof trainingSessions;
export type TrainingSlots = [TrainingSession, TrainingSession, TrainingSession];
export const trainingTemplates = {
  balanced: { label: '균형', slots: ['general', 'defense', 'rest'] },
  batting: { label: '타격 강화', slots: ['batting', 'power', 'rest'] },
  pitching: { label: '투수 강화', slots: ['pitching', 'control', 'rest'] },
  defense: { label: '수비 조직력', slots: ['defense', 'tactics', 'rest'] },
  fitness: { label: '체력 강화', slots: ['physical', 'general', 'rest'] },
  recovery: { label: '회복 우선', slots: ['recovery', 'rest', 'rest'] },
} satisfies Record<string, { label: string; slots: TrainingSlots }>;
export type TrainingTemplate = keyof typeof trainingTemplates;
export type TrainingReport = {
  from: string;
  date: string;
  days: number;
  averageLoad: number;
  rested: number;
  heavy: number;
};
export type TrainingCenter = {
  version: 1;
  responsibility: 'staff' | 'manager';
  programs: Record<
    TrainingSquad,
    { template: TrainingTemplate; days: Record<string, TrainingSlots> }
  >;
  restBelow: number;
  lightBelow: number;
  coaches: Partial<Record<TrainingDiscipline, string>>;
  lastDay?: string;
  tally?: {
    from: string;
    days: number;
    load: number;
    players: number;
    rested: number;
    heavy: number;
  };
  report?: TrainingReport;
};
export function defaultTrainingCenter(legacy = 'balanced'): TrainingCenter {
  const template: TrainingTemplate =
    legacy === 'rest'
      ? 'recovery'
      : legacy === 'power'
        ? 'batting'
        : legacy === 'pitching'
          ? 'pitching'
          : legacy === 'defense'
            ? 'defense'
            : 'balanced';
  return {
    version: 1,
    responsibility: 'staff',
    programs: {
      first: { template, days: {} },
      reserve: { template, days: {} },
    },
    restBelow: 60,
    lightBelow: 80,
    coaches: {},
  };
}
export const trainingCenterFor = (g: GameState) =>
  g.trainingCenter ?? defaultTrainingCenter(g.training);
export function trainingMonday(date: string) {
  return addDays(date, -(new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7);
}
export function reserveTrainingMatch(g: GameState, day = g.day) {
  if (day % 3 !== 0 || !g.reserve || !['preseason', 'regular'].includes(g.phase)) return false;
  const players = g.roster.filter((p) => p.squad === 'reserve' && isAvailable(p));
  return (
    players.filter((p) => p.pos !== 'P').length >= 9 &&
    players.some((p) => p.pos === 'C') &&
    players.some((p) => p.pos === 'P')
  );
}
export type TrainingDay = {
  date: string;
  weekday: number;
  squad: TrainingSquad;
  slots: TrainingSlots;
  match: boolean;
  modified: boolean;
};
export function trainingDay(
  g: GameState,
  squad: TrainingSquad,
  date: string,
  match: boolean,
  previousMatch: boolean,
  center = trainingCenterFor(g),
): TrainingDay {
  const program = center.programs[squad];
  const custom = center.responsibility === 'manager' ? program.days[date] : undefined;
  let slots: TrainingSlots = [...trainingTemplates[program.template].slots];
  if (previousMatch) slots[0] = 'recovery';
  if (match) slots = ['tactics', 'match', 'recovery'];
  if (custom) slots = [...custom];
  // Fixtures always reserve their slot, including rescheduled games after a plan was saved.
  if (match) slots[1] = 'match';
  else slots = slots.map((s) => (s === 'match' ? 'rest' : s)) as TrainingSlots;
  if (isClubSeasonRest(g)) {
    slots = ['rest', 'rest', 'rest'];
    match = false;
  }
  return {
    date,
    weekday: new Date(date + 'T12:00:00Z').getUTCDay(),
    squad,
    slots,
    match,
    modified: !!custom,
  };
}
export type TrainingDays = Record<TrainingSquad, TrainingDay>;
export function trainingCoach(g: GameState, discipline: TrainingDiscipline) {
  const center = trainingCenterFor(g);
  const assigned = g.staff.find(
    (c) => c.id === center.coaches[discipline] && c.role !== '스카우트',
  );
  const coach = assigned ?? g.staff.find((c) => c.role === trainingDisciplines[discipline]);
  const count = coach
    ? Object.keys(trainingDisciplines).filter((key) => {
        const id = center.coaches[key as TrainingDiscipline];
        return id ? id === coach.id : trainingDisciplines[key as TrainingDiscipline] === coach.role;
      }).length
    : 0;
  const suitability = coach?.role === trainingDisciplines[discipline] ? 1 : 0.7;
  const efficiency = coach
    ? ((0.55 + coach.skill / 120) * suitability) / (1 + Math.max(0, count - 1) * 0.2)
    : 0.7;
  return { coach, count, efficiency, specialist: suitability === 1 };
}
const zero = (): Record<AbilityKey, number> => ({
  contact: 0,
  power: 0,
  stuff: 0,
  control: 0,
  field: 0,
  speed: 0,
});
function sessionFocus(session: TrainingSession, pitcher: boolean) {
  const f = zero();
  const primary: AbilityKey[] = pitcher
    ? ['stuff', 'control', 'field', 'speed']
    : ['contact', 'power', 'field', 'speed'];
  if (['rest', 'recovery', 'match'].includes(session)) return f;
  for (const key of primary) f[key] = session === 'general' ? 0.55 : 0.15;
  if (session === 'batting') {
    f.contact = 1;
    f.power = 0.45;
  }
  if (session === 'power') {
    f.power = 1.1;
    f.contact = 0.3;
  }
  if (session === 'pitching') {
    f.stuff = 0.9;
    f.control = 0.65;
    f.field = 0.4;
  }
  if (session === 'control') {
    f.control = 1;
    f.stuff = 0.45;
    f.contact = 0.3;
  }
  if (session === 'defense') {
    f.field = 1;
    f.speed = 0.4;
  }
  if (session === 'physical') {
    f.speed = 1;
    f.power = 0.4;
    f.stuff = 0.4;
  }
  if (session === 'tactics') {
    f.field = 0.25;
    f.contact = 0.2;
    f.control = 0.2;
  }
  return f;
}
export type PlayerTrainingDay = {
  load: number;
  recovery: number;
  risk: number;
  factors: Record<AbilityKey, number>;
  rest: boolean;
  light: boolean;
  reason: string;
  tactical: number;
  positional: number;
};
export function playerTrainingDay(
  g: GameState,
  p: Player,
  day: TrainingDay,
  center = trainingCenterFor(g),
): PlayerTrainingDay {
  const injured = !!p.injury;
  const personalRest =
    !!p.trainingPlan &&
    (p.trainingPlan.focus === 'rest' || p.trainingPlan.restDays.includes(day.weekday));
  const rest = injured || personalRest || p.condition < center.restBelow;
  const light = !rest && p.condition < center.lightBelow;
  const scale = rest
    ? 0
    : (light ? 0.5 : 1) *
      (p.trainingPlan?.intensity === 'light'
        ? 0.65
        : p.trainingPlan?.intensity === 'intense'
          ? 1.25
          : 1);
  const factors = zero();
  let load = 0,
    recovery = 0,
    tactical = 0,
    positional = 0;
  for (const slot of day.slots) {
    const session = trainingSessions[slot];
    const unitScale =
      (session.group === 'pitching' && p.pos !== 'P') ||
      (session.group === 'batting' && p.pos === 'P')
        ? 0.5
        : 1;
    load += session.load * unitScale * scale;
    recovery += session.recovery;
    const focus = sessionFocus(slot, p.pos === 'P');
    for (const key of Object.keys(factors) as AbilityKey[]) factors[key] += focus[key] * scale;
    if (slot === 'tactics') tactical += 0.6 * scale;
    else if (slot === 'general' || slot === 'defense') tactical += 0.2 * scale;
    if (slot === 'defense') positional += scale;
    else if (slot === 'general') positional += 0.4 * scale;
  }
  const reason = injured
    ? '의무팀 관리 · 단체 훈련 제외'
    : personalRest
      ? '개인 휴식 계획'
      : rest
        ? `컨디션 ${center.restBelow}% 미만 · 자동 휴식`
        : light
          ? `컨디션 ${center.lightBelow}% 미만 · 절반 강도`
          : load === 0
            ? '팀 휴식 일정'
            : load > 3
              ? '높은 부담 · 추가 훈련 조정 권장'
              : '팀 일정과 개인 강도 적용';
  return {
    load,
    recovery: rest ? 8 : Math.min(6, recovery * 0.5) - Math.max(0, load - 1) * 2,
    risk: rest || load === 0 ? 0.45 : load > 3 ? 1.8 + (load - 3) * 0.25 : light ? 0.7 : 1,
    factors,
    rest: rest || load === 0,
    light,
    reason,
    tactical,
    positional,
  };
}
