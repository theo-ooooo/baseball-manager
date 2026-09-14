import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import { postseasonTarget } from '@dugout/shared/postseason';
import { useWorld } from '../career/world-context';

export function usePostseason(g: GameState) {
  const { getClub, getLeague, standings } = useWorld();
  const club = getClub(g.club),
    post = g.postseason;
  if (
    !post ||
    post.year !== g.year ||
    post.league !== club.league ||
    !post.rounds.length ||
    !['semifinal', 'final', 'finished'].includes(g.phase)
  )
    return null;
  const active = post.rounds.find((round) => round.stage === g.phase) || post.rounds.at(-1)!;
  const own = active.series.find((s) => s.a === g.club || s.b === g.club);
  const target = postseasonTarget(active.stage),
    wins = own ? (own.a === g.club ? own.aw : own.bw) : 0,
    losses = own ? (own.a === g.club ? own.bw : own.aw) : 0;
  const eliminated = !own || losses >= target;
  const rank = standings(g).findIndex((row) => row.club === g.club) + 1;
  const next = active.fixtures
    .filter(
      (f) =>
        f.status === 'scheduled' &&
        f.date >= gameDate(g) &&
        (f.home === g.club || f.away === g.club),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const qualified = post.rounds.some((round) =>
    round.series.some((s) => s.a === g.club || s.b === g.club),
  );
  const champion = g.phase === 'finished' && g.champion ? getClub(g.champion) : null;
  const title =
    g.phase === 'finished'
      ? g.champion === g.club
        ? '우승! 정상에 올랐습니다'
        : champion
          ? `${champion.name}, 챔피언`
          : '포스트시즌 종료'
      : eliminated
        ? qualified
          ? '이번 도전은 여기까지'
          : '포스트시즌 대진 확정'
        : active.stage === 'semifinal' && wins >= target
          ? '챔피언십 진출 확정!'
          : active.stage === 'final'
            ? `우승까지 ${target - wins}승`
            : wins + losses === 0
              ? '포스트시즌 진출!'
              : '마지막 아웃까지, 가을야구';
  const detail =
    g.phase === 'finished'
      ? `${getLeague(post.league).name} ${g.year} 시즌 최종 결과`
      : eliminated
        ? `${club.name} 정규시즌 ${rank}위 · 남은 대진과 결과를 확인하세요.`
        : wins >= target
          ? '준결승을 통과했습니다. 다른 대진이 끝나면 결승 일정이 확정됩니다.'
          : `${club.name} 정규시즌 ${rank}위 · ${wins}승 ${losses}패 · ${target}승 선취`;
  return {
    post,
    active,
    next,
    title,
    detail,
    eliminated,
    league: getLeague(post.league),
    champion,
  };
}
