import type { Player } from '@dugout/shared/types';
import type { MatchCommandKind } from '@dugout/shared/match-commands';

/** Decisions use the current batter, runners and outs only; future outcomes are unavailable. */
export function delegatedMatchCommand(
  ownBat: boolean,
  batter: Player,
  pitcher: Player,
  bases: (Player | null)[],
  outs: number,
): { kind: MatchCommandKind } {
  if (ownBat) {
    if ((bases[1] || bases[2]) && batter.contact >= batter.power) return { kind: 'contactFocus' };
    if (batter.power >= batter.contact + 10) return { kind: 'swingAway' };
    return { kind: 'workCount' };
  }
  if (bases[0] && outs < 2 && pitcher.control >= 60) return { kind: 'induceGrounder' };
  if (!bases[0] && batter.power >= 75) return { kind: 'pitchAround' };
  return { kind: 'attackBatter' };
}
