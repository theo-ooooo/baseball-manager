import type { GameState, Player } from '@dugout/shared/types';
import { firstTeam, defenseFor, defensivePositions } from '@dugout/shared/management';
import { lineupAuto } from '@dugout/shared/game-view';
import { preparePitching } from '@dugout/shared/pitching';
import { squadMoveError, type SquadLevel } from '@dugout/shared/roster-rules';

/** Keep unaffected lineup slots, defensive positions and pitcher assignments. */
function updateSelection(g: GameState, outgoing?: Player, incoming?: Player) {
  const active = firstTeam(g);
  const eligible = new Map(active.map((p) => [p.id, p]));
  const battingReplacement = outgoing?.pos !== 'P' && incoming?.pos !== 'P' ? incoming : undefined;
  const replaceBatter = (id: string) =>
    id === outgoing?.id && battingReplacement ? battingReplacement.id : id;
  const lineup = g.lineup.map(replaceBatter);
  const used = new Set(lineup.filter((id) => eligible.get(id)?.pos !== 'P' && eligible.has(id)));
  const candidates = lineupAuto(active).filter((id) => !used.has(id));
  g.lineup = lineup
    .map((id) => (eligible.has(id) && eligible.get(id)!.pos !== 'P' ? id : candidates.shift()!))
    .filter(Boolean);
  while (g.lineup.length < 9 && candidates.length) g.lineup.push(candidates.shift()!);

  if (outgoing?.pos === 'P' && incoming?.pos === 'P' && g.pitching) {
    const replacePitcher = (id: string) => (id === outgoing.id ? incoming.id : id);
    g.pitching.rotation = g.pitching.rotation.map(replacePitcher);
    g.pitching.bullpen = g.pitching.bullpen.map(replacePitcher);
    g.pitching.setup = g.pitching.setup?.map(replacePitcher);
    g.pitching.chase = g.pitching.chase?.map(replacePitcher);
    g.pitching.closer = replacePitcher(g.pitching.closer);
    g.starter = replacePitcher(g.starter);
  }
  if (!eligible.has(g.starter)) {
    g.starter =
      g.pitching?.rotation.find((id) => eligible.get(id)?.pos === 'P') ||
      active.find((p) => p.pos === 'P')!.id;
  }
  if (g.defense) {
    const fallback = defenseFor({ ...g, defense: undefined });
    const occupied = new Set<string>();
    for (const pos of defensivePositions) {
      const id = pos === 'P' ? g.starter : replaceBatter(g.defense[pos]);
      if (pos === 'P' || (g.lineup.includes(id) && !occupied.has(id))) {
        g.defense[pos] = id;
        occupied.add(id);
      } else g.defense[pos] = '';
    }
    for (const pos of defensivePositions) {
      if (g.defense[pos]) continue;
      const id = [fallback[pos], ...g.lineup].find(
        (candidate) => candidate && !occupied.has(candidate),
      )!;
      g.defense[pos] = id;
      occupied.add(id);
    }
  }
  preparePitching(g);
}

export function changeSquad(g: GameState, action: Record<string, unknown>) {
  if (
    typeof action.id !== 'string' ||
    !['first', 'reserve'].includes(String(action.value)) ||
    (action.replaceId !== undefined && typeof action.replaceId !== 'string')
  )
    throw new Error('선수와 등록 구분을 확인해 주세요.');
  const target = action.value as SquadLevel;
  const replaceId = action.replaceId as string | undefined;
  const error = squadMoveError(g, action.id, target, replaceId);
  if (error) throw new Error(error);
  const player = g.roster.find((p) => p.id === action.id)!;
  if ((player.squad || 'first') === target) return g;
  const replacement = g.roster.find((p) => p.id === replaceId);
  player.squad = target;
  if (replacement) replacement.squad = target === 'first' ? 'reserve' : 'first';
  updateSelection(
    g,
    target === 'reserve' ? player : replacement,
    target === 'first' ? player : replacement,
  );
  return g;
}
