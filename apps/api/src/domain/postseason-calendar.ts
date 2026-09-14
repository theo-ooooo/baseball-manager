import type { GameState, Result } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import {
  currentPostseasonRound,
  postseasonTarget,
  type PostseasonStage,
} from '@dugout/shared/postseason';

/** Also repairs an in-progress legacy bracket without guessing unrecorded past results. */
export function preparePostseason(g: GameState, league: string, startDay = g.day) {
  if (g.phase !== 'semifinal' && g.phase !== 'final') return;
  if (!g.postseason || g.postseason.year !== g.year || g.postseason.league !== league)
    g.postseason = { year: g.year, league, rounds: [] };
  if (currentPostseasonRound(g)) return;
  const stage: PostseasonStage = g.phase;
  const target = postseasonTarget(stage);
  g.postseason.rounds.push({
    stage,
    series: g.series.map((series) => ({ ...series })),
    fixtures: g.series.flatMap((series, seriesIndex) => {
      if (series.aw >= target || series.bw >= target) return [];
      const played = series.aw + series.bw;
      return Array.from({ length: target * 2 - 1 - played }, (_, index) => {
        const game = played + index + 1;
        const [home, away] = game % 2 ? [series.a, series.b] : [series.b, series.a];
        return {
          id: `post-${g.year}-${league}-${stage}-${seriesIndex}-${game}`,
          league,
          date: gameDate(g, startDay + index),
          home,
          away,
          generated: true,
          post: true as const,
          stage,
          seriesIndex,
          game,
          status:
            index < target - Math.max(series.aw, series.bw)
              ? ('scheduled' as const)
              : ('conditional' as const),
        };
      });
    }),
  });
}

export function recordPostseason(g: GameState, result: Result) {
  const round = currentPostseasonRound(g)!;
  const fixture = round.fixtures.find((fixture) => fixture.id === result.fixtureId)!;
  fixture.status = 'completed';
  fixture.score = { home: result.homeScore, away: result.awayScore };
  round.series = g.series.map((series) => ({ ...series }));
  const series = g.series[fixture.seriesIndex],
    target = postseasonTarget(round.stage);
  const clinched = series.aw >= target || series.bw >= target;
  const required = target - Math.max(series.aw, series.bw);
  for (const next of round.fixtures) {
    if (next.seriesIndex !== fixture.seriesIndex || next.game <= fixture.game) continue;
    next.status = clinched
      ? 'cancelled'
      : next.game <= fixture.game + required
        ? 'scheduled'
        : 'conditional';
  }
}
