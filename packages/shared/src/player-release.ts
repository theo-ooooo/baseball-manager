import type { GameState, Player } from './types';
import { financePlan } from './club-finance';
import { firstTeam } from './management';

/** Game contract settlement: unpaid current-season salary plus remaining guaranteed years. */
export function releaseCompensation(g: GameState, player: Player) {
  const days = financePlan(g, '').days;
  const current = Math.max(0, 1 - Math.min(days, g.finances?.settledDays || 0) / days);
  return Math.ceil(
    player.salary * (Math.max(0, player.years - 1) + (player.years > 0 ? current : 0)),
  );
}
export function releaseError(g: GameState, p: Player) {
  if (!g.roster.some((player) => player.id === p.id))
    return '우리 구단 소속 선수만 방출할 수 있습니다.';
  if (g.liveMatch) return '진행 중인 경기를 마친 뒤 방출할 수 있습니다.';
  if (g.roster.length <= 20) return '구단에 최소 20명이 필요합니다.';
  const minimum = { P: 7, C: 1, IF: 4, OF: 3, DH: 0 }[p.pos];
  const active = firstTeam(g);
  if (
    p.squad !== 'reserve' &&
    (active.length <= 22 || active.filter((v) => v.pos === p.pos).length <= minimum)
  )
    return '같은 포지션 선수를 먼저 1군에 올려 경기 편성 인원을 확보하세요.';
  if (releaseCompensation(g, p) > g.budget) return '잔여 보장 연봉을 정산할 예산이 부족합니다.';
  return '';
}
