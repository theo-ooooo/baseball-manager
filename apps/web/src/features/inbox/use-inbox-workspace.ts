'use client';
import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/use-mobile';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { newsMeta, newsNeedsAction } from './inbox-model';
export function useInboxWorkspace(g: GameState, act: Act, busy: boolean, initialReportId?: string) {
  const initialReport = g.news.find((n) => n.id === initialReportId);
  const [selectedId, setSelectedId] = useState(initialReport?.id || g.news[0]?.id || ''),
    [filter, setFilter] = useState('all'),
    [category, setCategory] = useState('all'),
    [search, setSearch] = useState(''),
    [detailOpen, setDetailOpen] = useState(!!initialReport || !!g.progress?.newsIds.length);
  const attempted = useRef(new Set<string>());
  const mobile = useIsMobile();
  const unread = g.news.filter((n) => !n.read),
    decisions = g.news.filter((n) => newsNeedsAction(n, g));
  const items = g.news.filter(
    (n) =>
      (filter === 'all' ||
        (filter === 'unread' && (!n.read || n.id === selectedId)) ||
        (filter === 'decision' && newsNeedsAction(n, g))) &&
      (category === 'all' || n.kind === category) &&
      `${n.title} ${n.body} ${newsMeta(n).sender}`.toLowerCase().includes(search.toLowerCase()),
  );
  // Keep the open letter in place after it becomes read; unread filters must not jump to another report.
  const selected = g.news.find((n) => n.id === selectedId);
  useEffect(() => {
    if (
      !selected ||
      selected.read ||
      g.liveMatch ||
      busy ||
      (mobile && !detailOpen) ||
      attempted.current.has(selected.id)
    )
      return;
    const timer = setTimeout(() => {
      attempted.current.add(selected.id);
      void act({ type: 'readNews', id: selected.id });
    }, 400);
    return () => clearTimeout(timer);
  }, [selected, act, busy, mobile, detailOpen, g.liveMatch]);
  function select(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }
  const nextUnread = unread.find((n) => n.id !== selectedId);
  return {
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
    setFilter,
    setCategory,
    setSearch,
    setDetailOpen,
  };
}
