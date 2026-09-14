import type { Fixture, GameState } from './types';

export type PostseasonStage = 'semifinal' | 'final';
export type PostseasonSeries = { a: string; b: string; aw: number; bw: number };
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
export type PostseasonState = { year: number; league: string; rounds: PostseasonRound[] };
export const postseasonLabel = (stage: PostseasonStage) =>
  stage === 'semifinal' ? '준결승' : '챔피언십';
export const postseasonTarget = (stage: PostseasonStage) => (stage === 'semifinal' ? 2 : 3);

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
