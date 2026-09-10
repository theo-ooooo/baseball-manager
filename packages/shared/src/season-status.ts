import type { GameState } from './types';

export function clubSeasonStatus(g: Pick<GameState, 'phase' | 'club' | 'series'>) {
  const postseason = g.phase === 'semifinal' || g.phase === 'final';
  const series = g.series.find((s) => s.a === g.club || s.b === g.club);
  const target = g.phase === 'semifinal' ? 2 : 3;
  const eliminated =
    postseason && (!series || (series.a === g.club ? series.bw : series.aw) >= target);
  const labels = {
    preseason: '프리시즌',
    regular: '정규 시즌',
    semifinal: '포스트시즌 · 준결승',
    final: '포스트시즌 · 결승',
    finished: '시즌 종료',
  };
  return {
    eliminated,
    label: eliminated ? '우리 팀 시즌 종료' : labels[g.phase],
    detail: eliminated ? '타 구단 포스트시즌 진행 중' : '',
  };
}

export function isClubSeasonRest(g: Pick<GameState, 'phase' | 'club' | 'series'>) {
  return g.phase === 'finished' || clubSeasonStatus(g).eliminated;
}
