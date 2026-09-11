import type { DefensivePosition, GameState, Player } from '@dugout/shared/types';
import { firstTeam, familiarity } from '@dugout/shared/management';
import { isAvailable } from '@dugout/shared/long-term';
import { coachAssessment, coachJudgment } from '@dugout/shared/coach-assessment';
import { matchPlanAt, type MatchPlan } from './match-plan-state';

export type PreviewSubstitution = {
  id: string;
  coach: string;
  judgment: string;
  slot: number;
  position: DefensivePosition;
  outgoing: Player;
  incoming: Player;
  reason: string;
  detail: string;
  plan: MatchPlan;
};

/** Minimum plate appearances before a batting average is treated as a slump rather than noise. */
const SAMPLE = 20;

const average = (p: Player) => (p.stats.ab ? p.stats.h / p.stats.ab : 0);

export function battingLine(p: Player) {
  return p.stats.ab >= SAMPLE
    ? `${p.stats.ab}타수 ${p.stats.h}안타 · 타율 ${average(p).toFixed(3)}`
    : `${p.stats.ab}타수 · 표본 부족`;
}

/**
 * Pre-match advice from the starting lineup's own season batting. The in-match coach reads
 * completed plays, which the preview has none of, so a slump is judged on season average and
 * condition instead. Applying it still goes through `reviseMatch` server validation.
 */
export function previewSubstitution(g: GameState): PreviewSubstitution | undefined {
  const live = g.liveMatch;
  if (!live?.timeline?.replayTeams || live.finished || live.cursor > 0) return;
  const coach = g.staff.find((c) => c.role === '타격') || g.staff[0];
  if (!coach) return;
  const judgment = coachJudgment(coach);
  const { plan } = matchPlanAt(g, 0);
  const players = firstTeam(g).filter(isAvailable);
  const byId = new Map(players.map((p) => [p.id, p]));
  const starting = new Set(plan.lineup);
  // The coach rates batting from ability and condition, the same basis used during a match.
  const score = (p: Player) => coachAssessment(coach, p, false) * (0.5 + p.condition / 200);
  const bench = players.filter((p) => p.pos !== 'P' && !starting.has(p.id) && p.condition >= 65);
  if (!bench.length) return;

  let best: PreviewSubstitution | undefined;
  for (const [slot, id] of plan.lineup.entries()) {
    const outgoing = byId.get(id);
    if (!outgoing) continue;
    const position = (Object.keys(plan.defense) as DefensivePosition[]).find(
      (pos) => pos !== 'P' && plan.defense[pos] === id,
    );
    if (!position) continue;
    const slump =
      outgoing.stats.ab >= SAMPLE && average(outgoing) < 0.24
        ? `시즌 ${battingLine(outgoing)}로 타격이 풀리지 않았습니다.`
        : outgoing.condition <= judgment.fatigue
          ? `컨디션이 ${Math.round(outgoing.condition)}%까지 떨어져 타격 생산을 기대하기 어렵습니다.`
          : '';
    if (!slump) continue;
    const incoming = bench
      .filter((p) => familiarity(p, position) >= 65)
      .toSorted((a, b) => score(b) - score(a))[0];
    if (!incoming) continue;
    const gain = score(incoming) - score(outgoing);
    if (gain < judgment.minimumGain) continue;
    if (best && gain <= score(best.incoming) - score(best.outgoing)) continue;
    const next = { ...plan, lineup: [...plan.lineup], defense: { ...plan.defense } };
    next.lineup[slot] = incoming.id;
    next.defense[position] = incoming.id;
    best = {
      id: `${live.timelineVersion ?? 0}:${outgoing.id}:${incoming.id}`,
      coach: coach.name,
      judgment: `능력 ${judgment.skill} · ${judgment.label}`,
      slot,
      position,
      outgoing,
      incoming,
      reason: slump,
      detail: `${incoming.name}은 ${battingLine(incoming)} · 컨디션 ${Math.round(incoming.condition)}%이며 ${position} 수비 숙련도 ${Math.round(familiarity(incoming, position))}입니다.`,
      plan: next,
    };
  }
  return best;
}
