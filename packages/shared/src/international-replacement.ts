import type { GameState } from './types';
import { isAvailable } from './long-term';
import { squadMoveError } from './roster-rules';
import { coachAssessment } from './coach-assessment';

export function nationalReplacement(g: GameState, outgoingId: string) {
  const outgoing = g.roster.find((p) => p.id === outgoingId);
  if (!outgoing?.internationalDuty || outgoing.squad === 'reserve') return undefined;
  const coach = g.staff.find((c) => c.role === (outgoing.pos === 'P' ? '투수' : '타격'));
  if (!coach) return undefined;
  const assessment = (p: GameState['roster'][number]) => coachAssessment(coach, p, p.pos === 'P');
  return g.roster
    .filter(
      (p) =>
        p.squad === 'reserve' &&
        p.pos === outgoing.pos &&
        isAvailable(p) &&
        !squadMoveError(g, p.id, 'first', outgoing.id),
    )
    .sort(
      (a, b) =>
        assessment(b) - assessment(a) || b.condition - a.condition || a.id.localeCompare(b.id),
    )[0];
}
