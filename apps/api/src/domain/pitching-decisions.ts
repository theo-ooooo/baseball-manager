export type PitchingAppearance = {
  id: string;
  outs: number;
  runs: number;
  entryLead: number;
  keptLead: boolean;
};

/** Decisions for the game's inning-boundary pitching changes.
 * A short-start win uses a deterministic effectiveness score in place of an
 * official scorer's discretion. Sources: MLB glossary win/save/hold.
 */
export function pitchingDecisions(
  appearances: PitchingAppearance[],
  starter: string,
  pitcherOfRecord: string,
  won: boolean,
) {
  const awards = { winner: '', save: '', holds: [] as string[] };
  if (!won) return awards;
  let winner = appearances.find((p) => p.id === pitcherOfRecord);
  if (!winner || (winner.id === starter && winner.outs < 15)) {
    winner = appearances
      .filter((p) => p.id !== starter && p.outs > 0)
      .sort((a, b) => b.outs - b.runs * 3 - (a.outs - a.runs * 3))[0];
  }
  awards.winner = winner?.id || '';
  const last = appearances.at(-1);
  if (
    last &&
    last.id !== starter &&
    last.id !== awards.winner &&
    last.entryLead > 0 &&
    last.keptLead &&
    ((last.entryLead <= 3 && last.outs >= 3) || last.outs >= 9)
  )
    awards.save = last.id;
  awards.holds = appearances
    .filter(
      (p) =>
        p !== last &&
        p.id !== starter &&
        p.id !== awards.winner &&
        p.outs > 0 &&
        p.entryLead > 0 &&
        p.entryLead <= 3 &&
        p.keptLead,
    )
    .map((p) => p.id);
  return awards;
}
