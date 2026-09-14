import type { GameState } from './types';
import {
  isPostseasonPhase,
  postseasonLabel,
  postseasonTarget,
  postseasonWinner,
  postseasonWaitingStage,
} from './postseason';
type SeasonState = Pick<GameState, 'phase' | 'club' | 'series'> &
  Partial<Pick<GameState, 'postseason'>>;
export function clubSeasonStatus(g: SeasonState) {
  const phase = g.phase;
  const postseason = isPostseasonPhase(phase);
  const series = g.series.find((s) => s.a === g.club || s.b === g.club);
  const waiting = postseasonWaitingStage(g);
  const winner =
    postseason && series
      ? postseasonWinner(series, postseasonTarget(phase, g.postseason?.format))
      : undefined;
  const eliminated = postseason && !waiting && (!series || (!!winner && winner !== g.club));
  const label = eliminated
    ? '우리 팀 시즌 종료'
    : waiting
      ? `${postseasonLabel(waiting, g.postseason?.format)} 직행`
      : postseason
        ? `포스트시즌 · ${postseasonLabel(phase, g.postseason?.format)}`
        : g.phase === 'preseason'
          ? '프리시즌'
          : g.phase === 'regular'
            ? '정규 시즌'
            : '시즌 종료';
  return {
    eliminated,
    waiting,
    label,
    detail: eliminated ? '타 구단 포스트시즌 진행 중' : waiting ? '앞선 라운드 승자 대기 중' : '',
  };
}
export function isClubSeasonRest(g: SeasonState) {
  return g.phase === 'finished' || clubSeasonStatus(g).eliminated;
}
