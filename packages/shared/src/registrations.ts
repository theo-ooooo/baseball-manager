import type { GameState, Player } from './types';
import { daysBetween, gameDate } from './calendar';
export type RegistrationRecall = { club: string; demoted: string; eligible: string; days: number };
export type RegistrationEvent = {
  id: string;
  date: string;
  club: string;
  playerId: string;
  name: string;
  pos: Player['pos'];
  from: 'first' | 'reserve';
  to: 'first' | 'reserve';
  reason: string;
  source: 'manager' | 'coach' | 'club';
  eligible?: string;
};
export type RegistrationState = {
  serial: number;
  events: RegistrationEvent[];
  recalls: Record<string, RegistrationRecall>;
  clubs: Record<string, { first: string[]; reviewed?: string }>;
};
// KBO 2026 constitution art. 27; NPB active-roster announcements; MLB option rules.
// Special replacement exemptions and option-year accounting are not modeled here.
export function recallWaitingDays(player: Pick<Player, 'club' | 'pos'>) {
  const league = player.club.split('-')[0];
  if (league === 'kbo' || league === 'npb') return 10;
  if (league === 'mlb') return player.pos === 'P' ? 15 : 10;
  return 0;
}
export function recallStatus(g: GameState, player: Pick<Player, 'id'>) {
  const recall = g.registrations?.recalls[player.id];
  if (!recall) return null;
  const remaining = Math.max(0, daysBetween(gameDate(g), recall.eligible));
  return { ...recall, remaining };
}
export function recallError(g: GameState, player: Pick<Player, 'id' | 'name'>) {
  const recall = recallStatus(g, player);
  return recall?.remaining
    ? `${player.name}은 ${recall.eligible}부터 1군에 재등록할 수 있습니다. (${recall.remaining}일 남음)`
    : null;
}
