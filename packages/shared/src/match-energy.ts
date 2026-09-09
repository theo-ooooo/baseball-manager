import type { Result } from './types';

/** Read saved values only. Does not calculate fatigue or inspect unplayed events. */
export function matchEnergy(result: Result, cursor: number) {
  const values = new Map<string, number>();
  for (const team of result.replayTeams || [])
    for (const player of team.players)
      if (player.condition !== undefined) values.set(player.id, player.condition);
  for (let i = 0; i < Math.min(cursor, result.log.length); i++) {
    const play = result.log[i].play;
    if (!play?.energy) continue;
    values.set(play.pitcher, play.energy.pitcher[1]);
    if (play.energy.batter) values.set(play.batter, play.energy.batter[1]);
    for (const [id, value] of play.energy.runners || []) values.set(id, value);
  }
  return values;
}
