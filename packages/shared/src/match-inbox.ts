import type { GameState } from './types';
import { gameDate } from './calendar';

/** Before a match, every unread letter matters, regardless of automatic date-stop preferences. */
export function unreadBeforeMatch(g: GameState, readIds: ReadonlySet<string> = new Set()) {
  if (g.liveMatch || g.managerCareer?.status === 'unemployed' || g.managerCareer?.vacationUntil)
    return [];
  return g.news
    .toReversed()
    .filter((n) => !n.read && !readIds.has(n.id))
    .sort((a, b) => (a.date || gameDate(g, a.day)).localeCompare(b.date || gameDate(g, b.day)));
}

export function matchInboxDecision(g: GameState, readIds?: ReadonlySet<string>) {
  const unread = unreadBeforeMatch(g, readIds);
  if (!unread.length) return null;
  return {
    count: unread.length,
    reportId: unread[0].id,
    reason: `안 읽은 수신함 ${unread.length}건을 확인한 뒤 경기를 진행해 주세요.`,
    label: `수신함 확인 · ${unread.length}`,
    href: `/?view=inbox&report=${encodeURIComponent(unread[0].id)}`,
  };
}
