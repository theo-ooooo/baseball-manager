import type { GameState, NewsItem } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';

export function orderedInbox(g: GameState, news: NewsItem[], order: string = 'oldest') {
  const direction = order === 'oldest' ? 1 : -1;
  return news
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        direction *
        ((a.item.date || gameDate(g, a.item.day)).localeCompare(
          b.item.date || gameDate(g, b.item.day),
        ) || b.index - a.index),
    )
    .map(({ item }) => item);
}
export function nextUnreadAfter(items: NewsItem[], selectedId: string) {
  return items
    .slice(Math.max(0, items.findIndex((n) => n.id === selectedId) + 1))
    .find((n) => !n.read);
}

export function firstUnreadReport(g: GameState) {
  return orderedInbox(g, g.news).find((n) => !n.read);
}

export function inboxReadingOrder(g: GameState, news: NewsItem[], displayed: NewsItem[]) {
  const ids = new Set(displayed.map((n) => n.id));
  return orderedInbox(g, news, 'oldest').filter((n) => ids.has(n.id));
}
