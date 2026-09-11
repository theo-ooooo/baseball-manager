'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { GameState } from '@dugout/shared/types';
import { careerMemory } from '../career/career-memory';
const empty = new Set<string>();
export function useInboxReadQueue(g: GameState | null) {
  const viewed = useSyncExternalStore(
    careerMemory.inbox.subscribe,
    careerMemory.inbox.snapshot,
    () => empty,
  );
  const markRead = useCallback(
    (ids: string[]) => {
      const unread = new Set(g?.news.filter((n) => !n.read).map((n) => n.id));
      careerMemory.inbox.mark(ids.filter((id) => unread.has(id)));
    },
    [g],
  );
  return { viewed, markRead };
}
