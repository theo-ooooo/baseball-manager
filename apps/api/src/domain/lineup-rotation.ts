import type { GameState, Player } from '@dugout/shared/types';
import { coachAssessment } from '@dugout/shared/coach-assessment';
import { isAvailable } from '@dugout/shared/long-term';

/** Rotate up to two comparable players without changing positions or the pitching order. */
export function rotateLineup(g: GameState, players: Player[], initial: string[]) {
  const coach = g.staff.find((c) => c.role === '타격');
  const ids = [...initial],
    changes: { incoming: Player; outgoing: Player; recent: number; sample: number }[] = [];
  if (!coach) return { ids, changes };
  const usage = (p: Player) => {
    const sample = p.mood?.recent.slice(-12) || [];
    return { sample: sample.length, played: sample.filter(Boolean).length };
  };
  const quality = (p: Player) => coachAssessment(coach, p, false) + p.field * 0.15;
  const candidates = players
    .filter(
      (p) =>
        !ids.includes(p.id) &&
        p.pos !== 'P' &&
        p.squad !== 'reserve' &&
        isAvailable(p) &&
        p.condition >= 75 &&
        usage(p).sample >= 6,
    )
    .sort(
      (a, b) =>
        usage(a).played / usage(a).sample - usage(b).played / usage(b).sample ||
        (a.mood?.value ?? 50) - (b.mood?.value ?? 50) ||
        quality(b) - quality(a) ||
        a.id.localeCompare(b.id),
    );
  const rotated = new Set<string>();
  for (const incoming of candidates) {
    if (changes.length >= 2) break;
    const recent = usage(incoming);
    const outgoing = players
      .filter(
        (p) =>
          ids.includes(p.id) &&
          !rotated.has(p.id) &&
          p.pos === incoming.pos &&
          usage(p).sample >= 6 &&
          usage(p).played - recent.played >= 3 &&
          quality(p) - quality(incoming) <= 6,
      )
      .sort(
        (a, b) =>
          usage(b).played - usage(a).played || a.condition - b.condition || quality(a) - quality(b),
      )[0];
    if (!outgoing) continue;
    ids[ids.indexOf(outgoing.id)] = incoming.id;
    rotated.add(incoming.id);
    changes.push({ incoming, outgoing, recent: recent.played, sample: recent.sample });
  }
  return { ids, changes };
}
