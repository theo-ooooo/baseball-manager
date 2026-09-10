import type { Player } from './types';

export const battingMetrics = [
  { id: 'avg', label: '타율' },
  { id: 'hr', label: '홈런' },
  { id: 'rbi', label: '타점' },
  { id: 'h', label: '안타' },
  { id: 'sb', label: '도루' },
] as const;
export const pitchingMetrics = [
  { id: 'era', label: '평균자책점' },
  { id: 'wins', label: '승리' },
  { id: 'k', label: '탈삼진' },
  { id: 'saves', label: '세이브' },
  { id: 'holds', label: '홀드' },
] as const;
export type LeaderMetric =
  (typeof battingMetrics)[number]['id'] | (typeof pitchingMetrics)[number]['id'];
export const inningsLabel = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`;
export const plateAppearances = (p: Player) => p.stats.ab + p.stats.bb + (p.stats.sh || 0);
export function leaderValue(p: Player, metric: LeaderMetric) {
  if (metric === 'avg') return p.stats.ab ? p.stats.h / p.stats.ab : null;
  if (metric === 'era') return p.stats.outs ? (p.stats.er * 27) / p.stats.outs : null;
  return p.stats[metric] || 0;
}
export function leaderValueLabel(p: Player, metric: LeaderMetric) {
  const value = leaderValue(p, metric);
  return value === null
    ? '—'
    : metric === 'avg'
      ? value.toFixed(3).replace(/^0/, '')
      : metric === 'era'
        ? value.toFixed(2)
        : String(value);
}
export function playerLeaders(
  players: Player[],
  games: ReadonlyMap<string, number>,
  metric: LeaderMetric,
  qualifiedOnly = true,
) {
  const pitching = pitchingMetrics.some((m) => m.id === metric);
  const rows = players
    .filter((p) =>
      pitching
        ? p.pos === 'P' && (p.stats.g > 0 || p.stats.outs > 0)
        : p.pos !== 'P' && plateAppearances(p) > 0,
    )
    .map((player) => {
      const teamGames = games.get(player.club) || 0;
      const required = pitching ? teamGames * 3 : Math.max(1, Math.round(teamGames * 3.1));
      const qualified =
        teamGames > 0 &&
        (pitching ? player.stats.outs >= required : plateAppearances(player) >= required);
      return { player, qualified, required, value: leaderValue(player, metric) };
    })
    .filter(
      (r) =>
        r.value !== null &&
        (!(qualifiedOnly && (metric === 'avg' || metric === 'era')) || r.qualified),
    )
    .sort(
      (a, b) =>
        (metric === 'era' ? a.value! - b.value! : b.value! - a.value!) ||
        a.player.name.localeCompare(b.player.name, 'ko') ||
        a.player.id.localeCompare(b.player.id),
    );
  let rank = 0;
  return rows.map((row, index) => {
    if (!index || row.value !== rows[index - 1].value) rank = index + 1;
    return { ...row, rank };
  });
}
