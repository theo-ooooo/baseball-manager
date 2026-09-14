import type { GameState, Result } from '@dugout/shared/types';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { rankStandings } from '@dugout/shared/game-view';
import {
  currentPostseasonRound,
  isPostseasonPhase,
  postseasonTarget,
  postseasonWinner,
  postseasonStages,
  postseasonRuleNote,
  type PostseasonStage,
  type PostseasonFormat,
} from '@dugout/shared/postseason';

function homeOrder(stage: PostseasonStage, format?: PostseasonFormat) {
  if (format !== 'kbo') return undefined;
  return stage === 'wildcard'
    ? [0, 0]
    : stage === 'final'
      ? [0, 0, 1, 1, 1, 0, 0]
      : [0, 0, 1, 1, 0];
}

function createRound(g: GameState, stage: PostseasonStage, startDay: number) {
  const post = g.postseason!,
    target = postseasonTarget(stage, post.format);
  post.rounds.push({
    stage,
    series: g.series.map((series) => ({ ...series })),
    fixtures: g.series.flatMap((series, seriesIndex) => {
      if (postseasonWinner(series, target)) return [];
      const played = series.aw + series.bw + (series.draws || 0);
      const maxGames = target * 2 - 1 - (series.advantageA || 0) + (series.draws || 0);
      const required = target - Math.max(series.aw + (series.advantageA || 0), series.bw);
      const order = homeOrder(stage, post.format);
      let day = startDay,
        previousHome = '';
      return Array.from({ length: maxGames - played }, (_, index) => {
        const game = played + index + 1;
        const reverse = order ? order[Math.min(game - 1, order.length - 1)] === 1 : game % 2 === 0;
        const [home, away] = reverse ? [series.b, series.a] : [series.a, series.b];
        if (index) day += post.format === 'kbo' && home !== previousHome ? 2 : 1;
        previousHome = home;
        return {
          id: `post-${g.year}-${post.league}-${stage}-${seriesIndex}-${game}`,
          league: post.league,
          date: gameDate(g, day),
          home,
          away,
          generated: true,
          post: true as const,
          stage,
          seriesIndex,
          game,
          status: index < required ? ('scheduled' as const) : ('conditional' as const),
        };
      });
    }),
  });
}

export function beginPostseason(g: GameState, league: string, ranked: string[], startDay = g.day) {
  const format: PostseasonFormat = league === 'kbo' && ranked.length >= 5 ? 'kbo' : 'four-team';
  const seeds = ranked.slice(0, format === 'kbo' ? 5 : 4);
  g.postseason = { year: g.year, league, format, seeds, rounds: [] };
  g.phase = format === 'kbo' ? 'wildcard' : 'semifinal';
  g.series =
    format === 'kbo'
      ? [{ a: seeds[3], b: seeds[4], aw: 0, bw: 0, advantageA: 1 }]
      : [
          { a: seeds[0], b: seeds[3], aw: 0, bw: 0 },
          { a: seeds[1], b: seeds[2], aw: 0, bw: 0 },
        ];
  createRound(g, g.phase, startDay);
}

/** An unplayed legacy KBO bracket can be corrected without discarding any completed game. */
export function preparePostseason(g: GameState, league: string, startDay = g.day) {
  if (!isPostseasonPhase(g.phase)) return;
  const post = g.postseason;
  if (
    league === 'kbo' &&
    g.phase === 'semifinal' &&
    !post?.format &&
    !g.liveMatch &&
    g.series.length === 2 &&
    g.series.every((s) => s.aw + s.bw === 0) &&
    !post?.rounds.some(
      (r) =>
        r.series.some((s) => s.aw + s.bw > 0) || r.fixtures.some((f) => f.status === 'completed'),
    ) &&
    !g.history.some((r) => r.post && (r.date ? r.date.startsWith(String(g.year)) : r.day >= 0))
  ) {
    beginPostseason(
      g,
      league,
      rankStandings(g.standings[league]).map((s) => s.club),
      startDay,
    );
    const id = `postseason-format-${g.year}`;
    if (!g.news.some((n) => n.id === id))
      g.news.unshift({
        id,
        title: 'KBO 포스트시즌 대진 수정',
        day: g.day,
        read: false,
        kind: 'league',
        body: `아직 시작하지 않은 대진에 순위별 진출 단계를 적용했습니다. ${postseasonRuleNote('kbo')}.`,
        actionView: 'schedule',
      });
    return;
  }
  if (!post || post.year !== g.year || post.league !== league)
    g.postseason = { year: g.year, league, format: 'four-team', rounds: [] };
  else if (!post.format) post.format = 'four-team';
  if (!currentPostseasonRound(g)) createRound(g, g.phase, startDay);
}

export function recordPostseason(g: GameState, result: Result) {
  const round = currentPostseasonRound(g)!;
  const fixture = round.fixtures.find((f) => f.id === result.fixtureId)!;
  const series = g.series[fixture.seriesIndex];
  if (fixture.status === 'completed') return;
  fixture.status = 'completed';
  fixture.score = { home: result.homeScore, away: result.awayScore };
  if (result.homeScore === result.awayScore) series.draws = (series.draws || 0) + 1;
  else if ((result.homeScore > result.awayScore ? result.home : result.away) === series.a)
    series.aw++;
  else series.bw++;
  round.series = g.series.map((s) => ({ ...s }));
  const target = postseasonTarget(round.stage, g.postseason?.format);
  const clinched = postseasonWinner(series, target);
  const required = target - Math.max(series.aw + (series.advantageA || 0), series.bw);
  for (const next of round.fixtures) {
    if (next.seriesIndex !== fixture.seriesIndex || next.game <= fixture.game) continue;
    next.status = clinched
      ? 'cancelled'
      : next.game <= fixture.game + required
        ? 'scheduled'
        : 'conditional';
  }
  // Preserve a draw as a draw; an additional game is necessary outside the wild-card advantage.
  if (!clinched && result.homeScore === result.awayScore) {
    const last = round.fixtures.filter((f) => f.seriesIndex === fixture.seriesIndex).at(-1)!;
    const game = last.game + 1;
    round.fixtures.push({
      ...last,
      id: `post-${g.year}-${last.league}-${round.stage}-${fixture.seriesIndex}-${game}`,
      game,
      date: addDays(last.date, 1),
      status: game <= fixture.game + required ? 'scheduled' : 'conditional',
      score: undefined,
    });
  }
}

export function advancePostseasonRound(g: GameState): 'waiting' | 'advanced' | 'finished' {
  if (!isPostseasonPhase(g.phase)) return 'waiting';
  const post = g.postseason!,
    target = postseasonTarget(g.phase, post.format);
  const winners = g.series.map((s) => postseasonWinner(s, target));
  if (!winners.length || winners.some((id) => !id)) return 'waiting';
  if (g.phase === 'final') {
    g.champion = winners[0]!;
    return 'finished';
  }
  if (post.format === 'kbo') {
    const stages = postseasonStages('kbo');
    g.phase = stages[stages.indexOf(g.phase) + 1];
    const rank = g.phase === 'semifinal' ? 3 : g.phase === 'playoff' ? 2 : 1;
    g.series = [{ a: post.seeds![rank - 1], b: winners[0]!, aw: 0, bw: 0 }];
  } else {
    g.phase = 'final';
    g.series = [{ a: winners[0]!, b: winners[1]!, aw: 0, bw: 0 }];
  }
  // KBO rounds have at least one travel/rest day between them.
  createRound(g, g.phase, g.day + (post.format === 'kbo' ? 2 : 1));
  return 'advanced';
}
