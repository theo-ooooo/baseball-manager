import type { Fixture, GameState } from './types';

export type PostseasonStage = 'wildcard' | 'semifinal' | 'playoff' | 'final';
export type PostseasonFormat = 'kbo' | 'four-team';
export type PostseasonSeries = {
  a: string;
  b: string;
  aw: number;
  bw: number;
  advantageA?: number;
  draws?: number;
};
export type PostseasonFixture = Fixture & {
  post: true;
  stage: PostseasonStage;
  seriesIndex: number;
  game: number;
  status: 'scheduled' | 'conditional' | 'completed' | 'cancelled';
  score?: { home: number; away: number };
};
export type PostseasonRound = {
  stage: PostseasonStage;
  series: PostseasonSeries[];
  fixtures: PostseasonFixture[];
};
export type PostseasonState = {
  year: number;
  league: string;
  format?: PostseasonFormat;
  seeds?: string[];
  rounds: PostseasonRound[];
};
export const isPostseasonPhase = (phase: string): phase is PostseasonStage =>
  ['wildcard', 'semifinal', 'playoff', 'final'].includes(phase);
export const postseasonStages = (format?: PostseasonFormat): PostseasonStage[] =>
  format === 'kbo' ? ['wildcard', 'semifinal', 'playoff', 'final'] : ['semifinal', 'final'];
export const postseasonLabel = (stage: PostseasonStage, format?: PostseasonFormat) =>
  ({
    wildcard: '와일드카드 결정전',
    semifinal: format === 'kbo' ? '준플레이오프' : '준결승',
    playoff: '플레이오프',
    final: format === 'kbo' ? '한국시리즈' : '챔피언십',
  })[stage];
export const postseasonTarget = (stage: PostseasonStage, format?: PostseasonFormat) =>
  stage === 'wildcard'
    ? 2
    : stage === 'final'
      ? format === 'kbo'
        ? 4
        : 3
      : stage === 'playoff' || format === 'kbo'
        ? 3
        : 2;
export const postseasonEntryStage = (rank: number): PostseasonStage =>
  rank === 1 ? 'final' : rank === 2 ? 'playoff' : rank === 3 ? 'semifinal' : 'wildcard';
export function postseasonWinner(series: PostseasonSeries, target: number) {
  if (series.aw + (series.advantageA || 0) + (series.advantageA ? series.draws || 0 : 0) >= target)
    return series.a;
  if (series.bw >= target) return series.b;
  return undefined;
}
export function postseasonFixtures(g: GameState, league?: string) {
  const post = g.postseason;
  return post && post.year === g.year && (!league || post.league === league)
    ? post.rounds.flatMap((round) => round.fixtures)
    : [];
}
export function currentPostseasonRound(g: GameState) {
  return g.postseason?.year === g.year
    ? g.postseason.rounds.find((round) => round.stage === g.phase)
    : undefined;
}
export function postseasonWaitingStage(g: Pick<GameState, 'club' | 'phase' | 'postseason'>) {
  if (g.postseason?.format !== 'kbo' || !isPostseasonPhase(g.phase)) return undefined;
  const rank = (g.postseason.seeds?.indexOf(g.club) ?? -1) + 1;
  if (!rank) return undefined;
  const entry = postseasonEntryStage(rank),
    stages = postseasonStages('kbo');
  return stages.indexOf(g.phase) < stages.indexOf(entry) ? entry : undefined;
}
export function postseasonRuleNote(format?: PostseasonFormat) {
  return format === 'kbo'
    ? '상위 5팀 진출 · 1위 한국시리즈, 2위 플레이오프, 3위 준플레이오프 직행 · 4·5위 와일드카드'
    : '상위 4팀 진출 · 준결승 3전 2선승 · 챔피언십 5전 3선승';
}
