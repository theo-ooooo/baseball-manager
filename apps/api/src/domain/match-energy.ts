import type { Player, ReplayPlay } from '@dugout/shared/types';
import type { PitchingApproach } from '@dugout/shared/pitching-tactics';

/** Match-local work. Career condition changes only when the prepared effects are committed. */
export function createMatchEnergy(
  rosters: Player[][],
  enabled: boolean,
  starterIds: string[] = [],
) {
  const remaining = new Map(rosters.flat().map((p) => [p.id, p.condition]));
  const usedPitchers = new Set<string>();
  const starters = new Set(starterIds);
  const get = (p: Player) => remaining.get(p.id) ?? p.condition;
  function spend(p: Player, work: number) {
    const before = get(p);
    const after = enabled ? Math.round(Math.max(10, before - work) * 10) / 10 : before;
    remaining.set(p.id, after);
    return [before, after] as [number, number];
  }
  function record(
    play: ReplayPlay,
    pitcher: Player,
    batter: Player,
    runners: Player[],
    approach: PitchingApproach,
    text: string,
  ) {
    if (!enabled) return;
    const steal = play.plateAppearance === false;
    const pitchingWork =
      play.command === 'intentionalWalk'
        ? 0
        : steal
          ? 0.6
          : 2 +
            (text.includes('볼넷') ? 0.6 : text.includes('삼진') ? 0.4 : 0) +
            (approach === 'corners' ? 0.5 : approach === 'attack' ? -0.25 : 0);
    const entryWork = !usedPitchers.has(pitcher.id) && !starters.has(pitcher.id) ? 8 : 0;
    usedPitchers.add(pitcher.id);
    const energy: NonNullable<ReplayPlay['energy']> = {
      pitcher: spend(pitcher, pitchingWork + entryWork),
    };
    if (!steal)
      energy.batter = spend(
        batter,
        text.includes('볼넷') || play.command === 'intentionalWalk' ? 0.6 : 1.4,
      );
    const changed: [string, number][] = [];
    for (const runner of runners) {
      const from = play.before.bases.indexOf(runner.id);
      const to = play.after.bases.indexOf(runner.id);
      if (from !== to || play.steal?.runner === runner.id)
        changed.push([runner.id, spend(runner, play.steal?.runner === runner.id ? 2 : 0.8)[1]]);
    }
    if (changed.length) energy.runners = changed;
    play.energy = energy;
  }
  return { get, record };
}
/** Starting condition already affects the engine; apply only additional match workload here. */
export const fatigueFactor = (condition: number, energy: number) =>
  Math.max(0.65, 1 - Math.max(0, condition - energy) * 0.004);
