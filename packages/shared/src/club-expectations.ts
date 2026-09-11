import type { Club, Player } from './types';
import type { ClubExpectation } from './manager-career';
import { overall } from './game-view';

export function clubExpectation(
  strengthRank: number,
  count: number,
  previousRank?: number,
): ClubExpectation {
  const rank = previousRank ? strengthRank * 0.65 + previousRank * 0.35 : strengthRank;
  const [targetRank, tier] =
    rank <= 1.5
      ? [1, '우승 도전']
      : rank <= Math.ceil(count * 0.3)
        ? [Math.ceil(count * 0.3), '상위권 경쟁']
        : rank <= Math.ceil(count * 0.55)
          ? [Math.ceil(count * 0.5), '상위 절반 진입']
          : rank <= Math.ceil(count * 0.8)
            ? [Math.ceil(count * 0.65), '중위권 도약']
            : [Math.ceil(count * 0.75), '전력 재건'];
  return {
    targetRank: Number(targetRank),
    tier: String(tier),
    strengthRank,
    previousRank,
    reason: `리그 내 선수단 전력 ${strengthRank}위${previousRank ? ` · 이전 시즌 ${previousRank}위` : ' · 이전 시즌 기록 없음'}`,
  };
}
/** A game's sporting expectations, not a claim about a real club's ownership policy. */
export function clubStrengthRanks(clubs: Club[], rosterFor: (club: string) => Player[]) {
  const groups = new Map<string, { id: string; strength: number }[]>();
  const average = (players: Player[], count: number) => {
    const best = players
      .map(overall)
      .sort((a, b) => b - a)
      .slice(0, count);
    return best.reduce((sum, value) => sum + value, 0) / Math.max(1, count);
  };
  for (const club of clubs) {
    const roster = rosterFor(club.id);
    const strength =
      average(
        roster.filter((p) => p.pos !== 'P'),
        9,
      ) *
        0.55 +
      average(
        roster.filter((p) => p.pos === 'P'),
        8,
      ) *
        0.45;
    const group = groups.get(club.league) || [];
    group.push({ id: club.id, strength });
    groups.set(club.league, group);
  }
  return Object.fromEntries(
    [...groups.values()].flatMap((rows) =>
      rows
        .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
        .map((row, i) => [row.id, i + 1]),
    ),
  );
}
