import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import {
  postseasonTarget,
  postseasonLabel,
  postseasonStages,
  postseasonEntryStage,
  postseasonWinner,
  postseasonRuleNote,
  isPostseasonPhase,
} from '@dugout/shared/postseason';
import { clubSeasonStatus } from '@dugout/shared/season-status';
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
    (!isPostseasonPhase(g.phase) && g.phase !== 'finished')
  )
    return null;
  const active = post.rounds.find((round) => round.stage === g.phase) || post.rounds.at(-1)!;
  const own = active.series.find((s) => s.a === g.club || s.b === g.club);
  const target = postseasonTarget(active.stage, post.format);
  const wins = own ? (own.a === g.club ? own.aw : own.bw) : 0;
  const losses = own ? (own.a === g.club ? own.bw : own.aw) : 0;
  const season = clubSeasonStatus(g);
  const rank =
    (post.seeds?.indexOf(g.club) ?? -1) >= 0
      ? post.seeds!.indexOf(g.club) + 1
      : standings(g).findIndex((row) => row.club === g.club) + 1;
  const next = active.fixtures
    .filter(
      (f) =>
        f.status === 'scheduled' &&
        f.date >= gameDate(g) &&
        (f.home === g.club || f.away === g.club),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const qualified =
    post.seeds?.includes(g.club) ||
    post.rounds.some((round) => round.series.some((s) => s.a === g.club || s.b === g.club));
  const champion = g.phase === 'finished' && g.champion ? getClub(g.champion) : null;
  const advanced = own && postseasonWinner(own, target) === g.club;
  const stages = postseasonStages(post.format);
  const title =
    g.phase === 'finished'
      ? g.champion === g.club
        ? '우승! 정상에 올랐습니다'
        : champion
          ? `${champion.name}, 챔피언`
          : '포스트시즌 종료'
      : season.waiting
        ? `${postseasonLabel(season.waiting, post.format)} 직행!`
        : season.eliminated
          ? qualified
            ? '이번 도전은 여기까지'
            : '포스트시즌 대진 확정'
          : advanced
            ? `${postseasonLabel(stages[stages.indexOf(active.stage) + 1] || 'final', post.format)} 진출 확정!`
            : active.stage === 'final'
              ? `우승까지 ${target - wins}승`
              : post.format === 'kbo'
                ? `${postseasonLabel(active.stage, post.format)} 출전!`
                : wins + losses === 0
                  ? '포스트시즌 진출!'
                  : '마지막 아웃까지, 가을야구';
  const detail =
    g.phase === 'finished'
      ? `${getLeague(post.league).name} ${g.year} 시즌 최종 결과`
      : season.waiting
        ? `${club.name} 정규시즌 ${rank}위 · 앞선 라운드 승자가 올라올 때까지 기다립니다.`
        : season.eliminated
          ? `${club.name} 정규시즌 ${rank}위 · 남은 대진과 결과를 확인하세요.`
          : advanced
            ? '진출을 확정했습니다. 남은 대진 종료 후 다음 라운드가 시작됩니다.'
            : active.stage === 'wildcard'
              ? `${club.name} 정규시즌 ${rank}위 · ${wins}승 ${losses}패 · ${own?.a === g.club ? '1승 또는 1무면 준플레이오프 진출' : '2승을 거둬야 준플레이오프 진출'}`
              : `${club.name} 정규시즌 ${rank}위 · ${wins}승 ${losses}패 · ${target}승 선취`;
  return {
    post,
    active,
    next,
    title,
    detail,
    eliminated: season.eliminated,
    league: getLeague(post.league),
    champion,
    ruleNote: postseasonRuleNote(post.format),
    stages: stages.map((stage, index) => {
      const round = post.rounds.find((r) => r.stage === stage);
      const seed =
        post.format === 'kbo'
          ? post.seeds?.findIndex((_, i) => postseasonEntryStage(i + 1) === stage)
          : undefined;
      const waitingClub =
        !round && seed !== undefined && seed >= 0 ? getClub(post.seeds![seed]) : undefined;
      return {
        stage,
        round,
        label: postseasonLabel(stage, post.format),
        target: postseasonTarget(stage, post.format),
        formatLabel:
          stage === 'wildcard'
            ? '최대 2경기'
            : `${postseasonTarget(stage, post.format) * 2 - 1}전 ${postseasonTarget(stage, post.format)}선승`,
        waitingClub,
        waitingTitle: waitingClub
          ? `정규시즌 ${seed! + 1}위 · ${postseasonLabel(stage, post.format)} 직행`
          : stage === 'final'
            ? '준결승 승자가 만납니다'
            : '이전 준결승 일정이 없습니다',
        waitingDetail: waitingClub
          ? `${postseasonLabel(stages[index - 1], post.format)} 승자 대기 · 상대 확정 후 일정 편성`
          : stage === 'final'
            ? '두 시리즈 종료 후 첫 경기 날짜와 대진이 확정됩니다.'
            : '이전 저장에 차전별 일정이 없어 확정된 챔피언십부터 표시합니다.',
      };
    }),
  };
}
