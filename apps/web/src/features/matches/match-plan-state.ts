import type { Defense, GameState, TeamInstructions } from '@dugout/shared/types';
import { defaults } from '@dugout/shared/management';

export type MatchPlan = {
  lineup: string[];
  pitcher: string;
  defense: Defense;
  instructions: TeamInstructions;
};

export function matchPlanAt(g: GameState, cursor: number) {
  const live = g.liveMatch!,
    timeline = live.timeline!;
  const side = live.home === g.club ? 1 : 0,
    team = timeline.replayTeams![side];
  const changes = (live.changes || []).filter((c) => c.cursor <= cursor);
  const current = changes.at(-1);
  const pitched = timeline.log
    .slice(0, cursor)
    .filter((e) => e.half !== side && e.play)
    .map((e) => e.play!.pitcher);
  const activePitcher =
    current?.cursor === cursor ? current.pitcher : pitched.at(-1) || team.defense.P;
  const plan: MatchPlan = {
    lineup: current?.lineup || team.lineup,
    pitcher: activePitcher,
    defense: { ...(current?.defense || team.defense), P: activePitcher },
    instructions: current?.instructions || g.instructions || defaults(g.tactic),
  };
  return {
    plan,
    usedBatters: new Set([...team.lineup, ...changes.flatMap((c) => c.lineup)]),
    usedPitchers: new Set([team.defense.P, ...pitched, activePitcher]),
  };
}
