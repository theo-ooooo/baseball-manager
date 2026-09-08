import type {
  DefensivePosition,
  Defense,
  GameState,
  Player,
  TeamInstructions,
  WorldCatalog,
} from './types';
import { hash, lineupAuto, overall } from './game-view';

export const defensivePositions: DefensivePosition[] = [
  'P',
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
];
export const positionLabels: Record<DefensivePosition, string> = {
  P: '투수',
  C: '포수',
  '1B': '1루수',
  '2B': '2루수',
  '3B': '3루수',
  SS: '유격수',
  LF: '좌익수',
  CF: '중견수',
  RF: '우익수',
  DH: '지명타자',
};
export const firstTeam = (g: GameState) => g.roster.filter((p) => p.squad !== 'reserve');
export const reserveTeam = (g: GameState) => g.roster.filter((p) => p.squad === 'reserve');
export const dayLabel = (day: number) => (day < 0 ? `프리시즌 ${day + 29}일차` : `${day + 1}일차`);
export const transfersBlocked = (g: GameState) =>
  !!g.rules?.firstSeasonTransferBan && g.year <= g.rules.startYear;
export const defaults = (tactic: string): TeamInstructions => ({
  steal: tactic === 'smallball' ? 85 : 25,
  patience: tactic === 'patient' ? 85 : 45,
  power: tactic === 'power' ? 85 : 45,
  depth: 50,
});
export function familiarity(p: Player, pos: DefensivePosition) {
  if (p.familiarity?.[pos] !== undefined) return p.familiarity[pos]!;
  if (pos === 'DH') return p.pos === 'P' ? 15 : 100;
  if (pos === 'P') return p.pos === 'P' ? 100 : 5;
  if (p.pos === 'P') return 10;
  const natural: DefensivePosition[] =
    p.pos === 'C'
      ? ['C']
      : p.pos === 'IF'
        ? ['1B', '2B', '3B', 'SS']
        : p.pos === 'OF'
          ? ['LF', 'CF', 'RF']
          : [];
  return natural.includes(pos)
    ? natural[hash(p.id) % natural.length] === pos
      ? 95
      : 74
    : pos === 'C'
      ? 15
      : 35;
}
export function autoDefense(g: GameState): Defense {
  const batters = g.lineup
    .map((id) => g.roster.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  const result = { P: g.starter } as Defense;
  for (const pos of defensivePositions.filter((p) => p !== 'P')) {
    const best = [...batters].sort(
      (a, b) => familiarity(b, pos) - familiarity(a, pos) || b.field - a.field,
    )[0];
    result[pos] = best?.id || '';
    if (best) batters.splice(batters.indexOf(best), 1);
  }
  return result;
}
export function defenseFor(g: GameState): Defense {
  const saved = g.defense;
  if (
    saved &&
    saved.P === g.starter &&
    new Set(Object.values(saved)).size === 10 &&
    defensivePositions.every((pos) => pos === 'P' || g.lineup.includes(saved[pos]))
  )
    return saved;
  return autoDefense(g);
}
export function defenseStrength(g: GameState) {
  const d = defenseFor(g);
  return (
    defensivePositions
      .filter((pos) => !['P', 'DH'].includes(pos))
      .reduce((sum, pos) => {
        const p = g.roster.find((p) => p.id === d[pos]);
        return sum + (p ? p.field * (0.4 + (0.6 * familiarity(p, pos)) / 100) : 0);
      }, 0) / 8
  );
}
export function selectFirstTeam(g: GameState) {
  const ids = new Set(lineupAuto(g.roster));
  for (const p of [...g.roster]
    .filter((p) => p.pos === 'P')
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 12))
    ids.add(p.id);
  for (const p of [...g.roster].sort((a, b) => overall(b) - overall(a)))
    if (ids.size < 28) ids.add(p.id);
  for (const p of g.roster) p.squad = ids.has(p.id) ? 'first' : 'reserve';
  g.lineup = lineupAuto(firstTeam(g));
  g.starter = firstTeam(g)
    .filter((p) => p.pos === 'P')
    .sort((a, b) => overall(b) - overall(a))[0].id;
  g.defense = autoDefense(g);
}
export function preseasonFixtures(g: GameState, world: Pick<WorldCatalog, 'clubs'>) {
  const league = world.clubs.find((c) => c.id === g.club)?.league;
  const opponents = world.clubs.filter((c) => c.league === league && c.id !== g.club);
  return [-22, -15, -8, -1].map((day, i) => ({
    day,
    pair:
      i % 2
        ? [opponents[(hash(g.club) + i) % opponents.length].id, g.club]
        : [g.club, opponents[(hash(g.club) + i) % opponents.length].id],
  }));
}
