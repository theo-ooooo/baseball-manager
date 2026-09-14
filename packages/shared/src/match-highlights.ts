import type { LiveMatch } from './types';
import { matchDecision } from './match-decision';
/** Consume routine plays in order and stop at a situation visible from the consumed past. */
export function highlightCursor(live: LiveMatch, club: string, from: number, focus: string[] = []) {
  const length = live.timeline!.log.length;
  const important = (cursor: number) => {
    if (cursor === 0) return true;
    const d = matchDecision(live, club, cursor),
      score = live.timeline!.log[cursor - 1]?.score || [0, 0];
    return (
      !!d.kind ||
      (d.inning >= 7 && Math.abs(score[0] - score[1]) <= 3) ||
      focus.includes(d.batterId || '') ||
      focus.includes(d.pitcherId || '')
    );
  };
  if (important(from)) return Math.min(length, from + 1);
  for (let cursor = from + 1; cursor < length; cursor++) if (important(cursor)) return cursor;
  return length;
}
