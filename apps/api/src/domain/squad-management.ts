import { isAvailable } from '@dugout/shared/long-term';
import type { PlayerTrainingDay } from '@dugout/shared/training-center';
import { pitchingAssignment, preparePitching } from '@dugout/shared/pitching';
import { prepareCalendar } from '@dugout/shared/calendar';
import { isPitchingApproach } from '@dugout/shared/pitching-tactics';
import type {
  DefensivePosition,
  GameState,
  Player,
  TeamInstructions,
  WorldCatalog,
} from '@dugout/shared/types';
import { blankStats, coachSkill, hash, lineupAuto, overall } from '@dugout/shared/game-view';
import {
  autoDefense,
  defaults,
  defenseFor,
  defensivePositions,
  familiarity,
  firstTeam,
  reserveTeam,
  selectFirstTeam,
} from '@dugout/shared/management';
import { refreshRatings } from './performance-ratings';
import { createPlayerGenerator } from './player-generator';
import { changeSquad } from './roster-moves';
import { prepareDevelopment } from './player-development';

export function prepareSquad(g: GameState, world: WorldCatalog) {
  // A live game's inputs remain frozen until its result has committed.
  if (g.liveMatch) return;
  prepareCalendar(g, world);
  if (g.catalogVersion !== world.version) {
    const catalog = new Map(world.players.map((p) => [p.id, p]));
    for (const p of [...g.roster, ...g.transferred]) {
      const base = catalog.get(p.id);
      if (base) refreshRatings(p, base);
    }
    for (const d of g.deals) {
      const base = catalog.get(d.player.id);
      if (base) refreshRatings(d.player, base);
    }
    // Add newly catalogued players without changing contracts or undoing transfers in a save.
    const known = new Set([...g.roster, ...g.transferred].map((p) => p.id));
    for (const p of world.players.filter((p) => p.real && p.club === g.club)) {
      if (g.roster.length >= 85) break;
      if (
        !known.has(p.id) &&
        !g.simulation?.retired.includes(p.id) &&
        !g.ownership[p.id] &&
        !g.roster.some(
          (v) => v.real && v.original === p.original && v.pos === p.pos && v.number === p.number,
        )
      )
        g.roster.push({ ...structuredClone(p), squad: 'reserve' });
    }
    g.catalogVersion = world.version;
  }
  if (!g.reserve) {
    const { makePlayer } = createPlayerGenerator(world);
    const registered = g.registrations?.clubs[g.club];
    if (registered) {
      const ids = new Set(registered.first);
      for (const p of g.roster) p.squad = ids.has(p.id) ? 'first' : 'reserve';
      g.lineup = lineupAuto(firstTeam(g).filter(isAvailable));
      g.starter = firstTeam(g).find((p) => p.pos === 'P' && isAvailable(p))?.id || g.starter;
      g.defense = autoDefense(g);
    } else selectFirstTeam(g);
    // Every club begins with enough academy players to field a separate development team.
    let i = 1200;
    for (const [pos, min] of [
      ['P', 5],
      ['C', 1],
      ['IF', 4],
      ['OF', 3],
      ['DH', 1],
    ] as const) {
      while (reserveTeam(g).filter((p) => p.pos === pos).length < min && g.roster.length < 85) {
        const p = makePlayer(g.club, i++, undefined, g.year);
        p.pos = pos;
        p.squad = 'reserve';
        if (pos === 'P') {
          p.stuff = p.contact;
          p.control = p.field;
        }
        g.roster.push(p);
      }
    }
    g.reserve = { w: 0, l: 0, d: 0, history: [] };
  }
  g.instructions ??= defaults(g.tactic);
  g.tacticFamiliarity ??= 55;
  g.tacticBook ??= [];
  g.defense = defenseFor(g);
  preparePitching(g);
  prepareDevelopment(g);
}
function activePlayer(g: GameState, id: unknown) {
  const p = firstTeam(g).find((p) => p.id === id);
  if (!p || !isAvailable(p)) throw new Error('출전 가능한 1군 선수를 선택해 주세요.');
  return p;
}
export function canRemove(g: GameState, p: Player) {
  if (p.squad === 'reserve') return;
  const active = firstTeam(g);
  const min = { P: 7, C: 1, IF: 4, OF: 3, DH: 0 }[p.pos];
  if (active.length <= 22 || active.filter((v) => v.pos === p.pos).length <= min)
    throw new Error(
      '1군 경기 편성에 필요한 선수가 부족합니다. 같은 포지션 선수를 먼저 올려 주세요.',
    );
}
export function managementAction(g: GameState, a: Record<string, unknown>): GameState | null {
  switch (a.type) {
    case 'syncCatalog':
      return g;
    case 'pitchingRole': {
      preparePitching(g);
      const p = activePlayer(g, a.id),
        plan = g.pitching!;
      if (
        p.pos !== 'P' ||
        !['starter', 'bullpen', 'setup', 'chase', 'closer'].includes(String(a.role))
      )
        throw new Error('투수 보직을 확인해 주세요.');
      if (pitchingAssignment(g, p) === a.role) return g;
      if (plan.rotation.includes(p.id) && a.role !== 'starter' && plan.rotation.length <= 1)
        throw new Error('선발투수는 최소 1명이 필요합니다.');
      if (a.role === 'starter' && !plan.rotation.includes(p.id) && plan.rotation.length >= 6)
        throw new Error('선발 로테이션은 최대 6명입니다.');
      const previousRotation = [...plan.rotation];
      const previousNext = Math.max(0, previousRotation.indexOf(g.starter));
      plan.rotation = plan.rotation.filter((id) => id !== p.id);
      plan.bullpen = plan.bullpen.filter((id) => id !== p.id);
      plan.setup = plan.setup!.filter((id) => id !== p.id);
      plan.chase = plan.chase!.filter((id) => id !== p.id);
      if (plan.closer === p.id) plan.closer = '';
      if (a.role === 'starter') plan.rotation.push(p.id);
      else if (a.role === 'closer') plan.closer = p.id;
      else {
        plan.bullpen.push(p.id);
        if (a.role === 'setup') plan.setup.push(p.id);
        if (a.role === 'chase') plan.chase.push(p.id);
      }
      if (g.starter === p.id && a.role !== 'starter') {
        const following = [
          ...previousRotation.slice(previousNext + 1),
          ...previousRotation.slice(0, previousNext),
        ];
        g.starter = following.find((id) => plan.rotation.includes(id)) || plan.rotation[0];
      }
      plan.next = Math.max(0, plan.rotation.indexOf(g.starter));
      preparePitching(g);
      return g;
    }
    case 'rotationOrder': {
      preparePitching(g);
      const ids = a.ids as string[],
        old = g.pitching!.rotation;
      if (
        !Array.isArray(ids) ||
        ids.length !== old.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !old.includes(id))
      )
        throw new Error('선발 순서를 확인해 주세요.');
      g.pitching!.rotation = ids;
      g.pitching!.next = Math.max(0, ids.indexOf(g.starter));
      return g;
    }
    case 'squad':
      return changeSquad(g, a);
    case 'defense': {
      const p = activePlayer(g, a.id),
        pos = String(a.position) as DefensivePosition;
      if (!defensivePositions.includes(pos) || (pos === 'P') !== (p.pos === 'P'))
        throw new Error('투수는 마운드에, 야수는 야수 포지션에 배치해 주세요.');
      const d = defenseFor(g);
      if (d[pos] === p.id) return g;
      if (pos === 'P') {
        g.starter = p.id;
        d.P = p.id;
      } else {
        const prior = defensivePositions.find((k) => d[k] === p.id);
        const displaced = d[pos];
        if (prior) d[prior] = displaced;
        else g.lineup = g.lineup.map((id) => (id === displaced ? p.id : id));
        d[pos] = p.id;
      }
      g.defense = d;
      g.tacticFamiliarity = Math.max(20, (g.tacticFamiliarity || 55) - 2);
      return g;
    }
    case 'positionTraining': {
      const p = g.roster.find((p) => p.id === a.id),
        pos = String(a.position) as DefensivePosition;
      if (p && a.position === '') {
        delete p.positionTraining;
        return g;
      }
      if (!p || !defensivePositions.includes(pos) || (pos === 'P') !== (p.pos === 'P'))
        throw new Error('훈련할 포지션을 확인해 주세요.');
      p.positionTraining = pos;
      return g;
    }
    case 'teamInstructions':
    case 'instructions': {
      if (
        a.type === 'teamInstructions' &&
        !['balanced', 'power', 'smallball', 'patient'].includes(String(a.preset))
      )
        throw new Error('전술을 확인해 주세요.');
      const input = a.value as TeamInstructions;
      const keys = ['steal', 'patience', 'power', 'depth'] as const;
      if (!input || keys.some((k) => !Number.isFinite(input[k]) || input[k] < 0 || input[k] > 100))
        throw new Error('전술 수치는 0~100 사이여야 합니다.');
      if (input.pitching !== undefined && !isPitchingApproach(input.pitching))
        throw new Error('투구 방침을 확인해 주세요.');
      const old = g.instructions || defaults(g.tactic);
      const change = keys.reduce((s, k) => s + Math.abs(input[k] - old[k]), 0) / 20;
      g.instructions = {
        steal: Math.round(input.steal),
        patience: Math.round(input.patience),
        power: Math.round(input.power),
        depth: Math.round(input.depth),
      };
      // Omitted by older clients: retain the club's pitching instruction.
      const pitching = input.pitching ?? old.pitching;
      if (pitching !== undefined) g.instructions.pitching = pitching;
      g.tacticFamiliarity = Math.max(20, (g.tacticFamiliarity || 55) - change);
      if (a.type === 'teamInstructions') g.tactic = String(a.preset);
      return g;
    }
    case 'saveTactic': {
      const name = typeof a.name === 'string' ? a.name.trim().slice(0, 30) : '';
      if (!name) throw new Error('전술 이름을 입력해 주세요.');
      const book = g.tacticBook || [];
      const old = book.find((t) => t.name === name);
      if (!old && book.length >= 5)
        throw new Error(
          '전술은 5개까지 저장할 수 있습니다. 기존 전술을 삭제하거나 같은 이름으로 저장하세요.',
        );
      const saved = {
        id: old?.id || `tactic-${g.year}-${hash(name)}`,
        name,
        tactic: g.tactic,
        lineup: [...g.lineup],
        starter: g.starter,
        defense: { ...defenseFor(g) },
        instructions: { ...(g.instructions || defaults(g.tactic)) },
        pitching: structuredClone(g.pitching),
      };
      g.tacticBook = [...book.filter((t) => t.name !== name), saved];
      return g;
    }
    case 'loadTactic': {
      const t = g.tacticBook?.find((t) => t.id === a.id);
      if (!t) throw new Error('저장한 전술을 찾을 수 없습니다.');
      for (const id of [...t.lineup, t.starter]) activePlayer(g, id);
      if (t.pitching) {
        for (const id of [...t.pitching.rotation, ...t.pitching.bullpen, t.pitching.closer].filter(
          Boolean,
        ))
          activePlayer(g, id);
        g.pitching = structuredClone(t.pitching);
      }
      g.lineup = [...t.lineup];
      g.starter = t.starter;
      g.defense = { ...t.defense };
      g.tactic = t.tactic;
      g.instructions = { ...t.instructions };
      g.tacticFamiliarity = Math.max(20, (g.tacticFamiliarity || 55) - 8);
      preparePitching(g);
      return g;
    }
    case 'deleteTactic':
      g.tacticBook = (g.tacticBook || []).filter((t) => t.id !== a.id);
      return g;
    default:
      return null;
  }
}
export function developTrainingFamiliarity(
  g: GameState,
  training?: Map<string, PlayerTrainingDay>,
) {
  const first = g.roster.filter((p) => p.squad !== 'reserve');
  const tactical = training
    ? first.reduce((sum, p) => sum + (training.get(p.id)?.tactical || 0), 0) /
      Math.max(1, first.length)
    : g.training === 'rest'
      ? 0.15
      : 0.7;
  g.tacticFamiliarity = Math.min(100, (g.tacticFamiliarity || 55) + tactical);
  const d = defenseFor(g);
  for (const p of g.roster) {
    if (!isAvailable(p)) continue;
    const pos = p.positionTraining || defensivePositions.find((k) => d[k] === p.id);
    const practice = training ? training.get(p.id)?.positional || 0 : g.training === 'rest' ? 0 : 1;
    if (pos && practice > 0) {
      p.familiarity ??= {};
      p.familiarity[pos] = Math.min(
        100,
        familiarity(p, pos) + (0.12 + coachSkill(g, '수비') / 400) * practice,
      );
    }
  }
}
export function developSquad(
  g: GameState,
  random: () => number,
  opponents: string[],
  trainingManaged = false,
) {
  if (!trainingManaged) developTrainingFamiliarity(g);
  if (g.day % 3 !== 0 || !['preseason', 'regular'].includes(g.phase) || !g.reserve) return;
  const roster = reserveTeam(g).filter(isAvailable),
    lineup = lineupAuto(roster).map((id) => roster.find((p) => p.id === id)!);
  const pitcher = roster
    .filter((p) => p.pos === 'P')
    .sort((a, b) => b.condition - a.condition || overall(b) - overall(a))[0];
  if (lineup.length < 9 || !pitcher || !lineup.some((p) => p.pos === 'C')) return;
  let hits = 0,
    own = 0;
  const played: Player[] = [];
  for (const p of lineup) {
    p.reserveStats ??= blankStats();
    const s = p.reserveStats;
    s.g++;
    played.push(p);
    for (let i = 0; i < 4; i++) {
      if (random() < 0.08) {
        s.bb++;
        continue;
      }
      s.ab++;
      if (random() < 0.23 + (p.contact - 60) * 0.003) {
        s.h++;
        hits++;
        if (random() < 0.1 + (p.power - 60) * 0.002) {
          s.hr++;
          s.rbi++;
          own++;
        }
      } else if (random() < 0.3) s.k++;
    }
    p.condition = Math.max(25, p.condition - 5);
  }
  const otherRuns = Math.floor(hits * (0.2 + random() * 0.3));
  own += otherRuns;
  for (let i = 0; i < otherRuns; i++) lineup[Math.floor(random() * 9)].reserveStats!.rbi++;
  const against = Math.max(0, Math.round(random() * 8 + (65 - overall(pitcher)) * 0.08));
  pitcher.reserveStats ??= blankStats();
  Object.assign(pitcher.reserveStats, {
    g: pitcher.reserveStats.g + 1,
    outs: pitcher.reserveStats.outs + 27,
    er: pitcher.reserveStats.er + against,
    wins: pitcher.reserveStats.wins + (own > against ? 1 : 0),
  });
  pitcher.condition = Math.max(20, pitcher.condition - 42);
  played.push(pitcher);
  const reserveDefense = autoDefense({
    ...g,
    roster,
    lineup: lineup.map((p) => p.id),
    starter: pitcher.id,
    defense: undefined,
  });
  for (const pos of defensivePositions) {
    const p = roster.find((p) => p.id === reserveDefense[pos]);
    if (p) {
      p.familiarity ??= {};
      p.familiarity[pos] = Math.min(100, familiarity(p, pos) + 0.2);
    }
  }
  if (own > against) g.reserve.w++;
  else if (own < against) g.reserve.l++;
  else g.reserve.d++;
  g.reserve.history.unshift({
    day: g.day,
    opponent: opponents[Math.abs(g.day) % opponents.length],
    own,
    against,
    played: played.map((p) => p.id),
  });
  g.reserve.history = g.reserve.history.slice(0, 60);
}
