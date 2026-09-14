import { isPostseasonPhase, postseasonEntryStage } from '@dugout/shared/postseason';
import type { GameState } from '@dugout/shared/types';
import { isUnemployed } from '@dugout/shared/manager-career';
import { useWorld } from '../career/world-context';

export function useStandingsTable(g: GameState, league?: string, compact = false) {
  const { getClub, standings } = useWorld();
  const ownLeague = getClub(g.club).league;
  const rows = standings(g, league);
  const ownIndex = rows.findIndex((s) => s.club === g.club);
  const show = compact
    ? ownIndex >= 8
      ? [...rows.slice(0, 7), rows[ownIndex]]
      : rows.slice(0, 8)
    : rows;
  const qualification =
    (league || ownLeague) !== ownLeague
      ? null
      : isPostseasonPhase(g.phase) || g.phase === 'finished'
        ? 'confirmed'
        : g.phase === 'regular'
          ? 'race'
          : null;
  const post =
    g.postseason?.year === g.year && g.postseason.league === ownLeague ? g.postseason : undefined;
  const format =
    isPostseasonPhase(g.phase) || g.phase === 'finished'
      ? post?.format || 'four-team'
      : ownLeague === 'kbo'
        ? 'kbo'
        : 'four-team';
  const slots = format === 'kbo' ? 5 : 4;
  const semifinal = post?.rounds.find((round) => round.stage === 'semifinal');
  const qualified = new Set(
    qualification === 'confirmed' && post?.seeds
      ? post.seeds
      : qualification === 'confirmed' && semifinal
        ? semifinal.series.flatMap((s) => [s.a, s.b])
        : rows.slice(0, slots).map((row) => row.club),
  );
  return {
    qualification,
    slots,
    format,
    rows: show.map((standing) => ({
      standing,
      rank: rows.indexOf(standing) + 1,
      own: standing.club === g.club && !isUnemployed(g),
      qualified: !!qualification && qualified.has(standing.club),
      entry:
        format === 'kbo'
          ? postseasonEntryStage(
              (post?.seeds?.indexOf(standing.club) ?? rows.indexOf(standing)) + 1,
            )
          : undefined,
      gap: ((rows[0].w - standing.w + standing.l - rows[0].l) / 2).toFixed(1),
    })),
  };
}
