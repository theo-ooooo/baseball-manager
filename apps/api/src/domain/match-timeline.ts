import { bullpenState } from '@dugout/shared/bullpen';
import { isAvailable } from '@dugout/shared/long-term';
import type {
  Defense,
  GameState,
  LiveMatch,
  MatchChange,
  MatchInput,
  Result,
  TeamInstructions,
} from '@dugout/shared/types';
import { rng } from '@dugout/shared/game-view';
import { isPitchingApproach } from '@dugout/shared/pitching-tactics';
import { defenseFor, defensivePositions, firstTeam } from '@dugout/shared/management';
import type { createMatchSimulator } from './match-simulation';

// Even adversarial random streams cannot create an unbounded Worker request.
export const MAX_MATCH_EVENTS = 1200;
export const MAX_MATCH_CHANGES = 40;
type Simulator = ReturnType<typeof createMatchSimulator>;

export function runMatch(iterator: Generator<Result, Result>) {
  let step = iterator.next();
  for (let count = 0; !step.done; count++) {
    if (count > MAX_MATCH_EVENTS)
      throw new Error('경기 처리 한도를 초과했습니다. 저장된 상태에서 다시 시도해 주세요.');
    step = iterator.next();
  }
  return step.value;
}
function inputFor(g: GameState): MatchInput {
  const {
    year,
    day,
    club,
    roster,
    lineup,
    starter,
    staff,
    tactic,
    pitching,
    instructions,
    tacticFamiliarity,
    calendar,
  } = g;
  return structuredClone({
    year,
    day,
    club,
    roster,
    lineup,
    starter,
    staff,
    tactic,
    pitching,
    instructions,
    tacticFamiliarity,
    calendar,
    defense: defenseFor(g),
  });
}
export function generateTimeline(g: GameState, simulate: Simulator) {
  const live = g.liveMatch!;
  const input = live.prepared?.input || inputFor(g);
  // Clone match inputs only. Season history, markets and finances never enter the simulator copy.
  const simulation: GameState = {
    ...g,
    ...structuredClone(input),
    liveMatch: { ...live, prepared: undefined, timeline: undefined },
  };
  const result = runMatch(
    simulate(
      simulation,
      live.home,
      live.away,
      rng(live.seed),
      !['regular', 'preseason'].includes(g.phase),
    ),
  );
  result.friendly = g.phase === 'preseason';
  live.prepared = {
    input,
    effects: simulation.roster.map(({ id, stats, condition, familiarity }) => ({
      id,
      stats,
      condition,
      familiarity,
    })),
  };
  live.timeline = result;
  live.timelineVersion = (live.timelineVersion || 0) + 1;
  live.playbackId ||= crypto.randomUUID();
  // Existing saved games retain the exact consumed prefix and relief-rule version.
  live.cursor = Math.min(live.cursor, result.log.length);
  live.result = visibleResult(live, live.cursor);
}
export function visibleResult(live: LiveMatch, cursor: number): Result {
  const result = live.timeline!;
  if (cursor >= result.log.length && live.finished) return result;
  const log = result.log.slice(0, cursor),
    score = log.at(-1)?.score || [0, 0];
  return {
    ...result,
    log,
    homeScore: score[1],
    awayScore: score[0],
    innings: [],
    hits: [],
    errors: [],
    mvp: '',
  };
}
export function applyMatchEffects(g: GameState) {
  const live = g.liveMatch!;
  if (!live.prepared || !live.timeline) throw new Error('먼저 경기 타임라인을 준비해 주세요.');
  const effects = new Map(live.prepared.effects.map((p) => [p.id, p]));
  for (const p of g.roster) {
    const effect = effects.get(p.id);
    if (effect)
      Object.assign(p, {
        stats: structuredClone(effect.stats),
        condition: Math.max(
          10,
          effect.condition -
            (live.bullpenVersion
              ? (live.warmups || []).filter((w) => w.playerId === p.id && w.mode === 'warm')
                  .length * 2
              : 0),
        ),
        familiarity: effect.familiarity && { ...effect.familiarity },
      });
  }
  const result = live.timeline;
  delete g.liveMatch;
  return result;
}
export function validateCursor(live: LiveMatch, a: Record<string, unknown>) {
  if (a.timelineVersion !== undefined && a.timelineVersion !== live.timelineVersion)
    throw new Error('경기 계획이 다른 화면에서 바뀌었습니다. 최신 타임라인을 불러와 주세요.');
  const cursor = a.cursor === undefined ? live.cursor : Number(a.cursor);
  if (!Number.isInteger(cursor) || cursor < live.cursor || cursor > live.timeline!.log.length)
    throw new Error('재생 위치가 올바르지 않습니다. 최신 경기를 불러와 주세요.');
  return cursor;
}
export function reviseTimeline(g: GameState, a: Record<string, unknown>, simulate: Simulator) {
  const live = g.liveMatch!;
  if (!live.timeline || !live.prepared) generateTimeline(g, simulate);
  const cursor = validateCursor(live, a);
  if (cursor >= live.timeline!.log.length || live.finished)
    throw new Error('종료된 경기는 변경할 수 없습니다.');
  if (
    (live.changes?.length || 0) + (live.commands?.length || 0) + (live.warmups?.length || 0) >=
    MAX_MATCH_CHANGES
  )
    throw new Error('한 경기의 변경 횟수를 초과했습니다.');
  const lineup = a.lineup;
  const eligible = firstTeam(g).filter(isAvailable),
    players = new Map(eligible.map((p) => [p.id, p]));
  if (
    !Array.isArray(lineup) ||
    lineup.length !== 9 ||
    new Set(lineup).size !== 9 ||
    lineup.some((id) => typeof id !== 'string' || !players.has(id) || players.get(id)!.pos === 'P')
  )
    throw new Error('1군 야수 9명으로 타순을 구성해 주세요.');
  const pitcher = String(a.pitcher);
  if (players.get(pitcher)?.pos !== 'P') throw new Error('1군 투수를 선택해 주세요.');
  const instructions = a.instructions as TeamInstructions;
  if (
    !instructions ||
    (['steal', 'patience', 'power', 'depth'] as const).some(
      (key) =>
        !Number.isInteger(instructions[key]) || instructions[key] < 0 || instructions[key] > 100,
    )
  )
    throw new Error('전술 수치는 0~100 사이로 입력해 주세요.');
  if (instructions.pitching !== undefined && !isPitchingApproach(instructions.pitching))
    throw new Error('투구 방침을 확인해 주세요.');
  const pastChanges = (live.changes || []).filter((change) => change.cursor < cursor);
  const previous = pastChanges.at(-1);
  const input = live.prepared!.input;
  const priorLineup = previous?.lineup || input.lineup;
  let coldEntry = false;
  if (cursor > 0) {
    const used = new Set([...input.lineup, ...pastChanges.flatMap((c) => c.lineup)]);
    for (let i = 0; i < 9; i++)
      if (lineup[i] !== priorLineup[i] && used.has(lineup[i]))
        throw new Error(
          '경기 중 타순을 바꾸거나 교체된 선수를 다시 투입할 수 없습니다. 벤치 선수를 골라 주세요.',
        );
    const ownHalf = live.home === g.club ? 1 : 0;
    const pitched = live
      .timeline!.log.slice(0, cursor)
      .filter((e) => e.half !== ownHalf && e.play)
      .map((e) => e.play!.pitcher);
    const currentPitcher = pitched.at(-1) || input.starter;
    if (pitcher !== currentPitcher && new Set([input.starter, ...pitched]).has(pitcher))
      throw new Error('이미 교체된 투수는 다시 등판할 수 없습니다.');
    if (pitcher !== currentPitcher && live.bullpenVersion) {
      const warm = bullpenState(live, pitcher, cursor).status;
      coldEntry = warm === 'standby' || warm === 'warming' || warm === 'tired';
      if (coldEntry && a.emergency !== true)
        throw new Error(
          '불펜 준비가 부족합니다. 2타석 이상 몸을 풀거나 피로를 감수한 긴급 투입을 확인해 주세요.',
        );
    }
    if (pitcher !== currentPitcher && live.timeline!.log[cursor]?.half === ownHalf)
      throw new Error('투수 교체는 우리 팀 수비 타석 직전에 확정해 주세요.');
  }
  let defense: Defense;
  if (a.defense !== undefined) {
    const requested = a.defense as Defense;
    if (
      !requested ||
      typeof requested !== 'object' ||
      Array.isArray(requested) ||
      Object.keys(requested).length !== defensivePositions.length ||
      requested.P !== pitcher ||
      new Set(Object.values(requested)).size !== 10 ||
      defensivePositions.some(
        (pos) =>
          typeof requested[pos] !== 'string' || (pos !== 'P' && !lineup.includes(requested[pos])),
      )
    )
      throw new Error('타순의 야수 9명과 선택한 투수를 수비 위치에 중복 없이 배치해 주세요.');
    defense = { ...requested };
  } else {
    // Older clients omit defense. Retain existing fielders and fill vacated positions once.
    defense = { ...(previous?.defense || input.defense!) };
    const retained = new Set(Object.values(defense).filter((id) => lineup.includes(id)));
    const remaining = lineup.filter((id) => !retained.has(id));
    for (const pos of defensivePositions.filter((p) => p !== 'P')) {
      if (lineup.includes(defense[pos])) continue;
      const candidate = lineup[priorLineup.indexOf(defense[pos])];
      const index = Math.max(0, remaining.indexOf(candidate));
      defense[pos] = remaining.splice(index, 1)[0];
    }
    defense.P = pitcher;
  }
  const change: MatchChange = {
    ...(coldEntry ? { coldEntry: true } : {}),
    cursor,
    lineup: [...lineup],
    pitcher,
    defense,
    instructions: {
      steal: instructions.steal,
      patience: instructions.patience,
      power: instructions.power,
      depth: instructions.depth,
      ...((instructions.pitching ?? g.instructions?.pitching) !== undefined
        ? { pitching: instructions.pitching ?? g.instructions?.pitching }
        : {}),
    },
  };
  const prefix = live.timeline!.log.slice(0, cursor);
  if (cursor === 0) {
    Object.assign(input, {
      lineup: change.lineup,
      starter: pitcher,
      defense,
      instructions: change.instructions,
    });
    live.changes = [];
    g.starter = pitcher;
  } else live.changes = [...pastChanges, change];
  live.cursor = cursor;
  generateTimeline(g, simulate);
  // A changed future is valid only if every already consumed event is unchanged.
  if (JSON.stringify(prefix) !== JSON.stringify(live.timeline!.log.slice(0, cursor)))
    throw new Error('이미 진행된 타석은 변경할 수 없습니다. 이전 계획을 유지해 주세요.');
  g.lineup = [...lineup];
  g.defense = { ...defense, P: g.starter };
  g.instructions = { ...change.instructions };
  return g;
}
