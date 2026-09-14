import type { Result } from './types';
import { isPitchingCommand, matchCommandLabels, type MatchCommand } from './match-commands';
import { playKind } from './replay';

const labels = {
  single: '1루타!',
  double: '2루타!',
  triple: '3루타!',
  homeRun: '홈런!!',
  walk: '볼넷 출루!',
  strikeout: '삼진!',
  doublePlay: '병살!',
  error: '실책 출루',
  sacrifice: '희생타!',
  tiebreak: '승부치기',
  out: '아웃!',
};

/** Presentation of completed server records only; never predicts or changes a play. */
export function matchCommandResults(
  result: Result,
  consumed: number,
  club: string,
  commands?: MatchCommand[],
) {
  const own = result.home === club ? 1 : result.away === club ? 0 : -1;
  return result.log.slice(0, Math.max(0, consumed)).flatMap((event, cursor) => {
    const play = event.play,
      command = play?.command;
    if (!play || !command || own < 0) return [];
    if (
      commands
        ? !commands.some((sign) => sign.cursor === cursor && sign.kind === command)
        : result.delegatedBy
    )
      return [];
    const defending = isPitchingCommand(command);
    if (defending === (event.half === own)) return [];
    const kind = playKind(event.text);
    const runs = play.after.score[event.half] - play.before.score[event.half];
    const outs = play.after.outs - play.before.outs;
    const hit = ['single', 'double', 'triple', 'homeRun'].includes(kind);
    const advanced = play.before.bases.some(
      (id, base) =>
        id && (play.after.bases.indexOf(id) > base || (!play.after.bases.includes(id) && runs > 0)),
    );
    const success =
      command === 'stealSecond' || command === 'stealThird'
        ? play.steal?.safe === true
        : command === 'bunt'
          ? advanced && (hit || (kind === 'sacrifice' && outs === 1))
          : command === 'swingAway'
            ? ['double', 'triple', 'homeRun'].includes(kind)
            : command === 'workCount'
              ? kind === 'walk'
              : command === 'hitAndRun'
                ? hit && advanced
                : command === 'contactFocus'
                  ? hit || (kind === 'sacrifice' && runs > 0)
                  : command !== 'intentionalWalk' && outs > 0 && runs === 0;
    const label =
      play.plateAppearance === false
        ? `${play.steal?.to || 2}루 도루 ${play.steal?.safe ? '성공!' : '실패'}`
        : command === 'intentionalWalk'
          ? '고의4구'
          : command === 'bunt' && success
            ? hit
              ? '번트 안타!'
              : '희생번트 성공!'
            : labels[kind];
    const playerId = defending
      ? play.pitcher
      : play.plateAppearance === false
        ? play.steal?.runner
        : play.batter;
    const player =
      result.replayTeams?.flatMap((team) => team.players).find((p) => p.id === playerId)?.name ||
      '';
    return [
      {
        id: `${result.id}:${cursor}`,
        cursor,
        inning: event.inning,
        half: event.half,
        command: matchCommandLabels[command],
        success,
        label,
        player,
        homeRun: kind === 'homeRun' && !defending,
        detail: defending
          ? runs > 0
            ? `${runs}실점`
            : play.after.outs === 3
              ? '이닝 종료 · 추가 실점 없이 수비 마무리'
              : `${outs}아웃 추가 · 실점 없음`
          : runs > 0
            ? `${runs}득점!`
            : advanced
              ? '주자 진루'
              : '',
      },
    ];
  });
}
export type MatchCommandResult = ReturnType<typeof matchCommandResults>[number];
