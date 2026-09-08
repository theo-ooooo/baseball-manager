import type { MatchChange, Result } from '@dugout/shared/types';
import { playKind } from '@dugout/shared/replay';
export const outcomeLabels: Record<ReturnType<typeof playKind>, string> = {
  single: '안타',
  double: '2루타',
  triple: '3루타',
  homeRun: '홈런',
  walk: '볼넷',
  strikeout: '삼진',
  doublePlay: '병살',
  error: '실책',
  sacrifice: '희생타',
  tiebreak: '승부치기',
  out: '범타',
};
/** Read only the consumed prefix. No probabilities, match engine, or future outcome inspection. */
export function matchReadout(
  result: Result,
  cursor: number,
  ownSide = 0,
  changes: MatchChange[] = [],
) {
  const count = Math.max(0, Math.min(result.log.length, cursor));
  const events = result.log.slice(0, count),
    current = events.at(-1);
  const outcomes = new Map<string, string[]>(),
    pitchers = new Map<number, string>();
  const defenses = new Map<number, MatchChange['defense']>();
  for (const event of events) {
    if (!event.play) continue;
    const prior = outcomes.get(event.play.batter) || [];
    prior.push(outcomeLabels[playKind(event.text)]);
    outcomes.set(event.play.batter, prior);
    pitchers.set(1 - event.half, event.play.pitcher);
    if (event.play.defense) defenses.set(1 - event.half, event.play.defense);
  }
  const change = changes.filter((c) => c.cursor <= count).at(-1);
  const teams = result.replayTeams?.map((team, side) => {
    const applied = side === ownSide ? change : undefined;
    const lineup = applied?.lineup || team.lineup;
    const defense = applied?.defense || defenses.get(side) || team.defense;
    const byId = new Map(team.players.map((p) => [p.id, p]));
    const latestPitcher =
      applied && applied.cursor === count
        ? applied.pitcher
        : pitchers.get(side) || applied?.pitcher || defense.P;
    return {
      club: side === 0 ? result.away : result.home,
      pitcher: byId.get(latestPitcher),
      lineup: lineup.map((id) => ({
        id,
        name: byId.get(id)?.name || '기록 없음',
        number: byId.get(id)?.number,
        position: Object.entries(defense).find(([, player]) => player === id)?.[0] || 'DH',
        outcomes: outcomes.get(id) || [],
        active: current?.play?.batter === id,
      })),
    };
  });
  const players = result.replayTeams?.flatMap((team) => team.players) || [];
  return {
    teams,
    current,
    score: current?.score || [0, 0],
    label: current ? outcomeLabels[playKind(current.text)] : '플레이볼 준비',
    batter: players.find((p) => p.id === current?.play?.batter)?.name || '',
    pitcher: players.find((p) => p.id === current?.play?.pitcher)?.name || '',
    count,
  };
}
