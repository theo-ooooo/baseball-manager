import type { GameState, Player, Result, WorldCatalog } from '@dugout/shared/types';
import type { ManagerConnection } from '@dugout/shared/manager-journey';
import { managerAbility, type ManagerAbility } from '@dugout/shared/manager-ability';
import { managerPlayingTrait } from '@dugout/shared/manager-traits';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { hash, rng, teamBudget } from '@dugout/shared/game-view';
import { matchBoxScore } from '@dugout/shared/match-box-score';
import { matchCommandResults } from '@dugout/shared/match-command-results';
import { createPlayerGenerator } from './player-generator';

const zero = (): ManagerAbility => ({
  tactics: 0,
  bullpen: 0,
  development: 0,
  motivation: 0,
  evaluation: 0,
});
export function prepareManagerJourney(g: GameState, world: WorldCatalog) {
  const career = g.managerCareer;
  if (!career || career.journey) return;
  const date = gameDate(g);
  career.journey = {
    version: 1,
    started: date,
    baseAbility: managerAbility({ id: `self:${g.manager}`, reputation: career.reputation }),
    experience: zero(),
    ledger: { date, totals: zero(), keys: [] },
    games: 0,
    wins: 0,
    connections: [],
    achievements: [],
    recentExperience: [],
  };
  // A fictional playing companion is part of the user's fictional biography only.
  if (career.background?.kind !== 'fictional' || !career.background.playingCareer) return;
  const id = `coach-teammate-${hash(`self:${g.manager}`)}`;
  const origin = career.history.at(-1)?.club || g.club;
  const club = world.clubs.find((c) => c.id === origin)!;
  const country = world.leagues.find((l) => l.id === club.league)!.country;
  const random = rng(hash(id));
  const name = createPlayerGenerator(world).generatedName(country, random);
  const trait = managerPlayingTrait(career.background);
  const role = trait?.bonus.bullpen ? '투수' : trait?.bonus.tactics ? '주루·작전' : '타격';
  const coach = {
    id,
    name,
    role,
    skill: 58 + (hash(id) % 12),
    salary: Math.max(1, Math.round(teamBudget(club.league) * 0.003)),
    style: '선수 시절 동료 · 가상 인물',
    real: false,
    source: '감독의 가상 선수 경력에서 생성',
  };
  (g.coachAssignments ??= {})[id] ??= { club: 'fa', coach };
  career.journey.connections.push({
    id,
    name,
    kind: 'coach',
    origin: 'teammate',
    firstMet: date,
    lastMet: date,
    club: origin,
    trust: 75,
    matches: 0,
    trainingDays: 0,
    growth: 0,
  });
}
/** Bounded daily ledger prevents retried/completed actions and previews from farming XP. */
export function creditManagerExperience(
  g: GameState,
  key: keyof ManagerAbility,
  amount: number,
  source: string,
  reason: string,
) {
  const journey = g.managerCareer?.journey;
  if (!journey || g.managerCareer?.status !== 'employed' || amount <= 0) return;
  const date = gameDate(g);
  if (date < journey.ledger.date) return;
  if (date > journey.ledger.date) journey.ledger = { date, totals: zero(), keys: [] };
  const event = `${key}:${source}`;
  if (journey.ledger.keys.includes(event)) return;
  const cap = { tactics: 10, bullpen: 10, development: 1, motivation: 4, evaluation: 6 }[key];
  const credit = Math.min(amount, cap - journey.ledger.totals[key], 1200 - journey.experience[key]);
  if (credit <= 0) return;
  journey.ledger.keys.push(event);
  journey.ledger.totals[key] += credit;
  journey.experience[key] += credit;
  journey.recentExperience = [
    { date, key, amount: credit, reason },
    ...journey.recentExperience,
  ].slice(0, 8);
}
function connection(
  g: GameState,
  id: string,
  name: string,
  kind: 'player' | 'coach',
): ManagerConnection | undefined {
  const journey = g.managerCareer?.journey;
  if (!journey || g.managerCareer?.status !== 'employed') return;
  let relation = journey.connections.find((r) => r.id === id);
  if (!relation) {
    // Keep payload bounded, preserving students, the playing companion and established ties.
    if (journey.connections.length >= 200) {
      const expendable = [...journey.connections]
        .filter((r) => !r.student && r.origin !== 'teammate' && r.club !== g.club)
        .sort((a, b) => a.trust - b.trust || a.lastMet.localeCompare(b.lastMet))[0];
      if (!expendable) return;
      journey.connections = journey.connections.filter((r) => r !== expendable);
    }
    relation = {
      id,
      name,
      kind,
      origin: 'team',
      firstMet: gameDate(g),
      lastMet: gameDate(g),
      club: g.club,
      trust: 50,
      matches: 0,
      trainingDays: 0,
      growth: 0,
    };
    journey.connections.push(relation);
  }
  relation.lastMet = gameDate(g);
  relation.club = g.club;
  return relation;
}
export function managerRelationshipReaction(g: GameState, id: string, change: number) {
  const relation = g.managerCareer?.journey?.connections.find((r) => r.id === id);
  if (relation) relation.trust = Math.max(0, Math.min(100, relation.trust + change));
}
export function observeManagerTraining(g: GameState, p: Player, growth: number) {
  const relation = connection(g, p.id, p.name, 'player');
  if (!relation || relation.lastTraining === gameDate(g)) return;
  relation.lastTraining = gameDate(g);
  relation.trainingDays++;
  relation.trust = Math.min(100, relation.trust + 0.1);
  if (p.age <= 23 && growth > 0) {
    relation.growth += growth;
    creditManagerExperience(g, 'development', 1, 'training', '유망주 훈련에서 실제 기량 성장');
  }
  if (relation.growth >= 0.5 && relation.trainingDays >= 28) relation.student = true;
}
export function awardManagerAchievement(
  g: GameState,
  id: string,
  title: string,
  detail: string,
  playerId?: string,
) {
  const journey = g.managerCareer?.journey;
  if (
    !journey ||
    g.managerCareer?.status !== 'employed' ||
    journey.achievements.some((a) => a.id === id)
  )
    return;
  journey.achievements.push({ id, title, detail, date: gameDate(g), club: g.club, playerId });
}
export function recordManagerMatch(g: GameState, result: Result) {
  const journey = g.managerCareer?.journey;
  if (
    !journey ||
    g.managerCareer?.status !== 'employed' ||
    ![result.home, result.away].includes(g.club)
  )
    return;
  const date = result.date || gameDate(g);
  if (
    date < journey.started ||
    (journey.lastMatch &&
      (date < journey.lastMatch.date ||
        (date === journey.lastMatch.date && journey.lastMatch.ids.includes(result.id))))
  )
    return;
  journey.lastMatch = {
    date,
    ids: [...(journey.lastMatch?.date === date ? journey.lastMatch.ids : []), result.id].slice(-8),
  };
  const side = result.home === g.club ? 1 : 0;
  const boxes = matchBoxScore(result);
  const own = boxes[side];
  const signs = matchCommandResults(
    result,
    result.log.length,
    g.club,
    result.managerReview?.commands || [],
  );
  creditManagerExperience(
    g,
    'tactics',
    3 + Math.min(2, signs.filter((s) => s.success).length),
    `match:${result.id}`,
    '경기 운영과 사인 결과 복기',
  );
  creditManagerExperience(
    g,
    'bullpen',
    3 + Math.min(2, own.pitchers.slice(1).filter((p) => p.outs > 0 && p.r === 0).length),
    `match:${result.id}`,
    '투수 운용과 구원 등판 복기',
  );
  if (!result.friendly) {
    journey.games++;
    if (
      (side ? result.homeScore : result.awayScore) > (side ? result.awayScore : result.homeScore)
    ) {
      journey.wins++;
      for (const target of [1, 10, 50, 100, 300, 500, 1000])
        if (journey.wins === target)
          awardManagerAchievement(
            g,
            `wins:${target}`,
            target === 1 ? '첫 승의 기억' : `감독 ${target}승`,
            `커리어 기록 시작 이후 공식 경기 ${target}승을 달성했습니다.`,
          );
    }
  }
  for (const id of new Set([...own.batters, ...own.pitchers].map((p) => p.id))) {
    const p = g.roster.find((p) => p.id === id);
    if (!p) continue;
    const relation = connection(g, id, p.name, 'player');
    if (!relation) continue;
    relation.matches++;
    relation.trust = Math.min(100, relation.trust + 0.4);
    if (relation.student && !result.friendly)
      awardManagerAchievement(
        g,
        `student:${id}`,
        `${p.name}, 육성에서 1군으로`,
        '28일 이상 함께 훈련하고 기량이 0.5 이상 성장한 유망주를 공식 경기에 기용했습니다.',
        id,
      );
  }
  for (const coach of g.staff) {
    const relation = connection(g, coach.id, coach.name, 'coach');
    if (relation) {
      relation.matches++;
      relation.trust = Math.min(100, relation.trust + 0.4);
    }
  }
  const opponent = new Set(
    [...boxes[1 - side].batters, ...boxes[1 - side].pitchers].map((p) => p.id),
  );
  const reunions = journey.connections
    .filter(
      (r) =>
        opponent.has(r.id) &&
        r.matches >= 5 &&
        (!r.lastReunion || daysBetween(r.lastReunion, date) >= 30),
    )
    .slice(0, 3);
  for (const r of reunions) r.lastReunion = date;
  if (reunions.length) {
    result.managerReview ??= { version: 1, club: g.club, commands: [], changes: [] };
    result.managerReview.reunions = reunions.map(({ id, name }) => ({ id, name }));
  }
}
export function recordManagerInternational(
  g: GameState,
  event: { id: string; name: string; players: string[] },
) {
  for (const relation of g.managerCareer?.journey?.connections || [])
    if (relation.student && event.players.includes(relation.id))
      awardManagerAchievement(
        g,
        `international:${relation.id}`,
        `${relation.name}, 국가대표 선발`,
        `함께 육성한 선수가 ${event.name} 대표팀에 선발됐습니다.`,
        relation.id,
      );
}
