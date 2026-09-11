'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { presentScoutingNews } from '@dugout/shared/scouting-guide';
import { presentTradeNews } from '@dugout/shared/trade-status';
import { useWorld } from '../career/world-context';
import { useIsMobile } from '../../hooks/use-mobile';
import type { GameState } from '@dugout/shared/types';
import type { useInboxReadQueue } from './use-inbox-read-queue';
import { orderedInbox, nextUnreadAfter } from './inbox-order';
import { newsMeta, newsNeedsAction } from './inbox-model';
export function useInboxWorkspace(
  g: GameState,
  reads: ReturnType<typeof useInboxReadQueue>,
  initialReportId?: string,
) {
  const { getClub } = useWorld();
  const news = useMemo(
    () =>
      g.news.map((item) =>
        presentTradeNews(
          presentScoutingNews(reads.viewed.has(item.id) ? { ...item, read: true } : item),
          g,
          (id) => getClub(id).name,
        ),
      ),
    [g, getClub, reads.viewed],
  );
  const displayGame = useMemo(() => ({ ...g, news }), [g, news]);
  const initialReport = news.find((n) => n.id === initialReportId);
  const [selectedId, setSelectedId] = useState(initialReport?.id || news[0]?.id || ''),
    [filter, setFilter] = useState('all'),
    [category, setCategory] = useState('all'),
    [search, setSearch] = useState(''),
    [detailOpen, setDetailOpen] = useState(!!initialReport || !!g.progress?.newsIds.length);
  const [order, setOrder] = useState('newest');
  const [unreadSession, setUnreadSession] = useState<Set<string>>(() => new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();
  const unread = news.filter((n) => !n.read),
    decisions = news.filter((n) => newsNeedsAction(n, displayGame));
  const items = orderedInbox(g, news, order).filter(
    (n) =>
      (filter === 'all' ||
        (filter === 'unread' && (!n.read || unreadSession.has(n.id))) ||
        (filter === 'decision' && newsNeedsAction(n, displayGame))) &&
      (category === 'all' || n.kind === category) &&
      `${n.title} ${n.body} ${newsMeta(n).sender}`.toLowerCase().includes(search.toLowerCase()),
  );
  // Keep the open letter in place after it becomes read; unread filters must not jump to another report.
  const selected = news.find((n) => n.id === selectedId);
  const markRead = reads.markRead;
  useEffect(() => {
    if (selected && !selected.read && !g.liveMatch && (!mobile || detailOpen))
      markRead([selected.id]);
  }, [selected, g.liveMatch, mobile, detailOpen, markRead]);
  useEffect(() => {
    if (!detailOpen) return;
    const frame = requestAnimationFrame(() => {
      if (mobile) toolbarRef.current?.scrollIntoView({ block: 'start' });
      else toolbarRef.current?.parentElement?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, detailOpen, mobile]);
  function select(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }
  const nextUnread = nextUnreadAfter(items, selectedId);
  const index = items.findIndex((n) => n.id === selectedId);
  return {
    displayGame,
    selectedId,
    filter,
    category,
    search,
    detailOpen,
    unread,
    decisions,
    items,
    selected,
    nextUnread,
    select,
    order,
    setOrder,
    toolbarRef,
    index,
    previous: index > 0 ? items[index - 1] : undefined,
    next: items[index + 1],
    setFilter: (value: string) => {
      setUnreadSession(new Set(unread.map((n) => n.id)));
      setFilter(value);
    },
    setCategory,
    setSearch,
    setDetailOpen,
  };
}
