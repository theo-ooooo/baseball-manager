'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveMatch } from '@dugout/shared/types';
import { matchSubstitutions, type MatchSubstitution } from './match-substitutions';

export function useMatchSubstitutions(
  live: LiveMatch,
  club: string,
  cursor: number,
  animating: boolean,
  active: boolean,
) {
  const events = useMemo(
    () => matchSubstitutions(live.timeline!, cursor, club, live.changes),
    [live.timeline, live.changes, cursor, club],
  );
  // Reloading or revising a timeline keeps old changes in the history without replaying alerts.
  const seenCursor = useRef(cursor - (animating ? 1 : 0));
  const [queue, setQueue] = useState<MatchSubstitution[]>([]);
  useEffect(() => {
    if (!active) return;
    const fresh = events.filter((event) => event.cursor >= seenCursor.current);
    if (!fresh.length) {
      seenCursor.current = Math.max(seenCursor.current, cursor);
      return;
    }
    const timer = setTimeout(() => {
      seenCursor.current = Math.max(seenCursor.current, cursor);
      setQueue((previous) => [...previous, ...fresh].slice(-3));
    }, 0);
    return () => clearTimeout(timer);
  }, [events, cursor, active]);
  const current = queue[0];
  const dismiss = useCallback(() => setQueue((previous) => previous.slice(1)), []);
  useEffect(() => {
    if (!current || !active) return;
    // Readable at 8× too; this notice never pauses or resumes the game.
    const timer = setTimeout(dismiss, 7000);
    return () => clearTimeout(timer);
  }, [current, active, dismiss]);
  return { events, current, dismiss };
}
