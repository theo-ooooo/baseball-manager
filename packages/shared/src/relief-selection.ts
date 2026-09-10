import type { PitchingPlan, Player } from './types';

/** Bullpen priorities apply only when the simulator decides a change is needed. */
export function selectReliever({
  plan,
  roster,
  used,
  inning,
  lead,
  legacy = false,
  version = 3,
}: {
  plan: PitchingPlan;
  roster: Player[];
  used: ReadonlySet<string>;
  inning: number;
  lead: number;
  legacy?: boolean;
  version?: 2 | 3;
}) {
  const closing = inning >= 9 && lead > 0 && lead <= 3;
  const setup = plan.setup || [],
    chase = plan.chase || [];
  const general = plan.bullpen.filter((id) => !setup.includes(id) && !chase.includes(id));
  let ids: string[];
  if (legacy)
    ids = closing
      ? [plan.closer, ...plan.bullpen]
      : [...plan.bullpen, ...(inning >= 9 ? [plan.closer] : [])];
  else if (version === 2) {
    const relief =
      lead < 0
        ? [...chase, ...general, ...setup]
        : inning >= 6 && lead <= 3
          ? [...setup, ...general, ...chase]
          : [...general, ...chase, ...setup];
    ids = closing ? [plan.closer, ...relief] : [...relief, ...(inning >= 9 ? [plan.closer] : [])];
  } else {
    const relief =
      Math.abs(lead) >= 4 || lead < 0
        ? [...chase, ...general, ...setup]
        : inning >= 6
          ? [...setup, ...general, ...chase]
          : [...general, ...chase, ...setup];
    // Keep the closer out of lopsided games even when the other arms are tired or used.
    // A tied late game may use the closer after the rest of the available bullpen.
    const others = relief.filter((id) => id !== plan.closer);
    ids = closing
      ? [plan.closer, ...others]
      : [...others, ...(inning >= 9 && lead === 0 ? [plan.closer] : [])];
  }
  const candidates = [...new Set(ids)]
    .map((id) => roster.find((p) => p.id === id && p.pos === 'P' && p.squad !== 'reserve'))
    .filter((p): p is Player => !!p && !used.has(p.id));
  return candidates.find((p) => p.condition >= 50) || candidates[0];
}
