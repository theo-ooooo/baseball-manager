'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Result } from '@dugout/shared/types';
import type { MatchCommand } from '@dugout/shared/match-commands';
import { matchCommandResults, type MatchCommandResult } from './match-command-results';

export function useMatchCommandResults(
  result: Result,
  consumed: number,
  club: string,
  active: boolean,
  commands?: MatchCommand[],
) {
  const events = useMemo(
    () => matchCommandResults(result, consumed, club, commands),
    [result, consumed, club, commands],
  );
  const seen = useRef(consumed);
  const [queue, setQueue] = useState<MatchCommandResult[]>([]);
  useEffect(() => {
    if (!active) return;
    const fresh = events.filter((event) => event.cursor >= seen.current);
    const timer = setTimeout(() => {
      seen.current = Math.max(seen.current, consumed);
      if (fresh.length) setQueue((previous) => [...previous, ...fresh].slice(-3));
    }, 0);
    return () => clearTimeout(timer);
  }, [events, consumed, active]);
  const current = queue[0];
  const dismiss = useCallback(() => setQueue((previous) => previous.slice(1)), []);
  useEffect(() => {
    if (!current || !active) return;
    const timer = setTimeout(dismiss, 7000);
    return () => clearTimeout(timer);
  }, [current, active, dismiss]);
  return { events, current, dismiss };
}
