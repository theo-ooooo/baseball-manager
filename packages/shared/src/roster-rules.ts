import type { GameState, Player } from './types';
import { recallError } from './registrations';
import { firstTeam } from './management';

export const FIRST_TEAM_LIMIT = 28;
export const firstTeamLimit = (club: string) => (club.startsWith('kbo-') ? 29 : FIRST_TEAM_LIMIT);
export type SquadLevel = 'first' | 'reserve';
const minimum: Record<Player['pos'], number> = { P: 7, C: 1, IF: 4, OF: 3, DH: 0 };
const labels: Record<Player['pos'], string> = {
  P: '투수',
  C: '포수',
  IF: '내야수',
  OF: '외야수',
  DH: '지명타자',
};

/** Read-only eligibility shared by the command handler and player selection UI. */
export function squadMoveError(
  g: GameState,
  playerId: string,
  target: SquadLevel,
  replaceId?: string,
): string | null {
  if (g.liveMatch) return '진행 중인 경기를 먼저 마쳐 주세요.';
  const player = g.roster.find((p) => p.id === playerId);
  if (!player) return '우리 구단 선수를 선택해 주세요.';
  const current = player.squad || 'first';
  if (replaceId === undefined && current === target) return null;
  if (current === target) return '선수의 등록 상태가 바뀌었습니다. 다시 선택해 주세요.';
  const replacement =
    replaceId === undefined ? undefined : g.roster.find((p) => p.id === replaceId);
  if (
    replaceId !== undefined &&
    (!replacement || replacement.id === player.id || (replacement.squad || 'first') !== target)
  )
    return '반대 선수단에 있는 교체 선수를 선택해 주세요.';
  const incoming = target === 'first' ? player : replacement;
  const outgoing = target === 'reserve' ? player : replacement;
  if (incoming?.internationalDuty) return '국가대표 차출에서 복귀한 뒤 1군에 등록할 수 있습니다.';
  const recall = incoming && recallError(g, incoming);
  if (recall) return recall;
  const active = firstTeam(g).filter((p) => p.id !== outgoing?.id);
  if (incoming) active.push(incoming);
  if (active.length > firstTeamLimit(g.club))
    return `1군 정원은 ${firstTeamLimit(g.club)}명입니다. 내려갈 선수를 선택해 함께 교체해 주세요.`;
  if (outgoing) {
    if (active.length < 22)
      return '1군은 최소 22명이 필요합니다. 함께 올라올 선수를 선택해 주세요.';
    if (active.filter((p) => p.pos === outgoing.pos).length < minimum[outgoing.pos])
      return `${labels[outgoing.pos]}는 최소 ${minimum[outgoing.pos]}명이 필요합니다. 같은 포지션 선수와 교체해 주세요.`;
  }
  return null;
}
