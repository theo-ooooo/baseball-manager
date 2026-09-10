import type { AbilityKey, GameState } from '@dugout/shared/types';
import { addDays, gameDate } from '@dugout/shared/calendar';
import {
  defaultTrainingCenter,
  playerTrainingDay,
  trainingCenterFor,
  trainingCoach,
  trainingDisciplines,
  trainingSessions,
  trainingTemplates,
  type TrainingDays,
  type PlayerTrainingDay,
  type TrainingSlots,
  type TrainingSquad,
  type TrainingDiscipline,
} from '@dugout/shared/training-center';
import { postNews } from './club-dynamics';

export function trainingCenterAction(g: GameState, a: Record<string, unknown>): GameState | null {
  if (
    !['setTrainingSchedule', 'setTrainingStaff', 'setTrainingRest', 'training'].includes(
      String(a.type),
    )
  )
    return null;
  if (g.liveMatch) throw new Error('훈련 계획은 진행 중인 경기를 마친 뒤 변경해 주세요.');
  const center = (g.trainingCenter ??= defaultTrainingCenter(g.training));
  if (a.type === 'training') {
    if (!['balanced', 'power', 'pitching', 'defense', 'rest'].includes(String(a.value)))
      throw new Error('훈련을 확인해 주세요.');
    g.training = String(a.value);
    const plan = defaultTrainingCenter(g.training);
    for (const squad of ['first', 'reserve'] as const)
      center.programs[squad] = plan.programs[squad];
    return g;
  }
  if (a.type === 'setTrainingRest') {
    const rest = Number(a.restBelow),
      light = Number(a.lightBelow);
    if (
      ![40, 50, 60, 65, 70].includes(rest) ||
      ![60, 70, 75, 80, 85, 90].includes(light) ||
      light <= rest
    )
      throw new Error('휴식 기준보다 가벼운 훈련 기준을 높게 설정해 주세요.');
    center.restBelow = rest;
    center.lightBelow = light;
    return g;
  }
  if (a.type === 'setTrainingStaff') {
    if (!['staff', 'manager'].includes(String(a.responsibility)))
      throw new Error('훈련 일정 담당을 선택해 주세요.');
    const choices = a.coaches;
    if (!choices || typeof choices !== 'object' || Array.isArray(choices))
      throw new Error('코치 담당을 확인해 주세요.');
    const valid: typeof center.coaches = {};
    for (const [key, value] of Object.entries(choices)) {
      if (
        !Object.hasOwn(trainingDisciplines, key) ||
        typeof value !== 'string' ||
        (value && !g.staff.some((c) => c.id === value && c.role !== '스카우트'))
      )
        throw new Error('소속 훈련 코치에게 담당을 지정해 주세요.');
      if (value) valid[key as TrainingDiscipline] = value;
    }
    center.coaches = valid;
    center.responsibility = a.responsibility as typeof center.responsibility;
    return g;
  }
  const squad = a.squad as TrainingSquad;
  if (
    !['first', 'reserve'].includes(squad) ||
    !Object.hasOwn(trainingTemplates, String(a.template))
  )
    throw new Error('선수단과 훈련 프로그램을 확인해 주세요.');
  const dates = a.days;
  if (!dates || typeof dates !== 'object' || Array.isArray(dates) || Object.keys(dates).length > 7)
    throw new Error('한 번에 7일 이내의 훈련 일정을 저장할 수 있습니다.');
  const today = gameDate(g),
    latest = addDays(today, 27);
  const updates: Record<string, TrainingSlots> = {};
  for (const [date, slots] of Object.entries(dates)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T12:00:00Z')) ||
      addDays(date, 0) !== date ||
      date < today ||
      date > latest
    )
      throw new Error('오늘부터 4주 이내의 훈련만 변경할 수 있습니다.');
    if (
      !Array.isArray(slots) ||
      slots.length !== 3 ||
      slots.some((s) => typeof s !== 'string' || !Object.hasOwn(trainingSessions, s))
    )
      throw new Error('하루 세 시간대의 훈련을 선택해 주세요.');
    updates[date] = [...slots] as TrainingSlots;
  }
  center.responsibility = 'manager';
  const program = center.programs[squad];
  program.template = a.template as typeof program.template;
  program.days = Object.fromEntries(
    Object.entries({ ...program.days, ...updates }).filter(
      ([date]) => date >= today && date <= latest,
    ),
  );
  return g;
}

/** Calculate once per elapsed day; growth, recovery and medical risk share these results. */
export function prepareDailyTraining(g: GameState, days: TrainingDays) {
  const center = (g.trainingCenter ??= defaultTrainingCenter(g.training));
  const coaches = Object.fromEntries(
    Object.keys(trainingDisciplines).map((key) => [
      key,
      trainingCoach(g, key as TrainingDiscipline).efficiency,
    ]),
  ) as Record<TrainingDiscipline, number>;
  const facility = 1 + ((g.facilities?.training || 1) - 1) * 0.08;
  const results = new Map<string, PlayerTrainingDay>();
  for (const p of g.roster) {
    const result = playerTrainingDay(
      g,
      p,
      days[p.squad === 'reserve' ? 'reserve' : 'first'],
      center,
    );
    for (const key of Object.keys(result.factors) as AbilityKey[]) {
      const discipline =
        key === 'stuff' || key === 'control'
          ? 'pitching'
          : key === 'field'
            ? 'defense'
            : key === 'speed'
              ? 'fitness'
              : 'batting';
      result.factors[key] *= coaches[discipline] * facility;
    }
    results.set(p.id, result);
  }
  return results;
}
export function recordDailyTraining(g: GameState, results: Map<string, PlayerTrainingDay>) {
  const center = trainingCenterFor(g),
    today = gameDate(g);
  if (center.lastDay === today) return;
  center.lastDay = today;
  const tally = (center.tally ??= {
    from: today,
    days: 0,
    load: 0,
    players: 0,
    rested: 0,
    heavy: 0,
  });
  tally.days++;
  for (const result of results.values()) {
    tally.players++;
    tally.load += result.load;
    if (result.rest) tally.rested++;
    if (result.load > 3) tally.heavy++;
  }
  for (const program of Object.values(center.programs))
    program.days = Object.fromEntries(
      Object.entries(program.days).filter(
        ([date]) => date >= addDays(today, -7) && date <= addDays(today, 27),
      ),
    );
  if (tally.days < 7) return;
  const report = (center.report = {
    from: tally.from,
    date: today,
    days: tally.days,
    averageLoad: Math.round((tally.load / Math.max(1, tally.players)) * 10) / 10,
    rested: tally.rested,
    heavy: tally.heavy,
  });
  center.tally = undefined;
  postNews(
    g,
    '주간 훈련 보고',
    `선수별 일일 평균 부담 ${report.averageLoad.toFixed(1)} · 휴식 ${report.rested}인일 · 높은 부담 ${report.heavy}인일. ${report.heavy ? '추가 훈련과 개인 강도를 점검해 주세요.' : '경기 일정에 맞춰 회복과 훈련을 이어가고 있습니다.'}`,
    'development',
    {
      actionView: 'training',
      sender: { name: '훈련 담당 코치', role: '주간 훈련 점검' },
      report: {
        facts: [
          { label: '점검 기간', value: `${report.from} ~ ${today}` },
          { label: '평균 일일 부담', value: `${report.averageLoad.toFixed(1)} / 높음 기준 3.0` },
          { label: '휴식 적용', value: `${report.rested}인일` },
          { label: '높은 부담', value: `${report.heavy}인일` },
        ],
        sections: [
          {
            title: '훈련 점검',
            body: '인일은 선수별 훈련일을 더한 수입니다. 경기 출전 경험과 훈련은 성장에 함께 반영되며, 휴식일에는 훈련으로 능력이 오르지 않습니다. 훈련 센터에서 주간 일정, 개인 강도와 코치 담당을 검토하세요.',
          },
        ],
      },
    },
  );
}
