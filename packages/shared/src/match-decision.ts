import type { LiveMatch } from './types';
import { nextMatchHalf } from './match-commands';

/** The next matchup is derived from completed plays, never from a future result. */
export function matchDecision(live: LiveMatch, club: string, cursor: number) {
  const result = live.timeline!;
  const count = Math.max(0, Math.min(cursor, result.log.length));
  const past = result.log.slice(0, count);
  const previous = past.at(-1);
  const half = nextMatchHalf(live, count);
  const own = live.home === club ? 1 : 0;
  const switched = previous?.play?.after.outs === 3;
  const outs = switched ? 0 : previous?.play?.after.outs || 0;
  const bases = switched ? [null, null, null] : previous?.play?.after.bases || [null, null, null];
  const inning = (previous?.inning || 1) + (switched && previous?.half === 1 ? 1 : 0);
  const change = live.changes?.filter((entry) => entry.cursor <= count).at(-1);
  const batting = result.replayTeams?.[half];
  const lineup = half === own && change ? change.lineup : batting?.lineup || [];
  const appearances = past.filter(
    (event) => event.half === half && event.play && event.play.plateAppearance !== false,
  ).length;
  const slot = appearances % 9;
  const batterId = lineup[slot];
  const pitcherId =
    half !== own && change?.cursor === count
      ? change.pitcher
      : past.findLast((event) => event.half === half && event.play)?.play?.pitcher ||
        result.replayTeams?.[1 - half].defense.P;
  const players = result.replayTeams?.flatMap((team) => team.players) || [];
  const finished = count >= result.log.length;
  return {
    cursor: count,
    inning,
    half,
    outs,
    bases,
    slot,
    batterId,
    pitcherId,
    batter: players.find((p) => p.id === batterId)?.name || '',
    pitcher: players.find((p) => p.id === pitcherId)?.name || '',
    attacking: half === own,
    kind:
      !finished && (bases[1] || bases[2])
        ? half === own
          ? ('opportunity' as const)
          : ('threat' as const)
        : null,
    situation: `${inning}회 ${half ? '말' : '초'} · ${outs}사 · ${
      bases
        .map((id, i) => (id ? `${i + 1}루` : ''))
        .filter(Boolean)
        .join('·') || '주자 없음'
    }`,
    finished,
  };
}
