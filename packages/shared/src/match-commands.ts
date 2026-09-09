import type { LiveMatch } from './types';

export type MatchCommandKind =
  | 'stealSecond'
  | 'stealThird'
  | 'bunt'
  | 'hitAndRun'
  | 'attackBatter'
  | 'pitchAround'
  | 'induceGrounder'
  | 'intentionalWalk';
export type MatchCommand = { cursor: number; kind: MatchCommandKind };
export const matchCommandLabels: Record<MatchCommandKind, string> = {
  stealSecond: '2루 도루',
  stealThird: '3루 도루',
  bunt: '희생번트',
  hitAndRun: '히트앤드런',
  attackBatter: '정면 승부',
  pitchAround: '유인구 승부',
  induceGrounder: '낮게 승부',
  intentionalWalk: '고의4구',
};
export const isPitchingCommand = (kind: MatchCommandKind) =>
  ['attackBatter', 'pitchAround', 'induceGrounder', 'intentionalWalk'].includes(kind);
/** Infer the next half from consumed outs, never from an unreplayed result. */
export function nextMatchHalf(live: LiveMatch, cursor: number) {
  const previous = live.timeline?.log[cursor - 1];
  return previous ? (previous.play?.after.outs === 3 ? 1 - previous.half : previous.half) : 0;
}
/** Only the already watched state determines which instructions can be issued. */
export function matchCommandOptions(live: LiveMatch, club: string, cursor: number) {
  const event = live.timeline?.log[cursor - 1],
    state = event?.play?.after;
  const ownHalf = live.home === club ? 1 : 0;
  const common =
    !event || !state || cursor >= (live.timeline?.log.length || 0)
      ? '타석 결과를 확인한 뒤 지시하세요.'
      : event.half !== ownHalf
        ? '우리 팀 공격 중에 지시할 수 있습니다.'
        : state.outs >= 3
          ? '공수 교대 후 주자 상황을 확인하세요.'
          : '';
  return (Object.keys(matchCommandLabels) as MatchCommandKind[]).map((kind) => {
    if (isPitchingCommand(kind))
      return {
        kind,
        label: matchCommandLabels[kind],
        reason:
          cursor >= (live.timeline?.log.length || 0)
            ? '경기가 종료되었습니다.'
            : nextMatchHalf(live, cursor) === ownHalf
              ? '우리 팀 수비 중에 지시할 수 있습니다.'
              : '',
      };
    const reason =
      common ||
      (kind === 'stealSecond'
        ? !state!.bases[0] || state!.bases[1]
          ? '1루 주자가 있고 2루가 비어 있어야 합니다.'
          : ''
        : kind === 'stealThird'
          ? !state!.bases[1] || state!.bases[2]
            ? '2루 주자가 있고 3루가 비어 있어야 합니다.'
            : ''
          : kind === 'bunt'
            ? state!.outs >= 2 || (!state!.bases[0] && !state!.bases[1]) || state!.bases[2]
              ? '0~1아웃, 1·2루 주자가 있고 3루가 비어 있을 때 지시하세요.'
              : ''
            : state!.outs >= 2 || !state!.bases[0] || state!.bases[1]
              ? '0~1아웃, 1루 주자가 있고 2루가 비어 있어야 합니다.'
              : '');
    return { kind, label: matchCommandLabels[kind], reason };
  });
}
