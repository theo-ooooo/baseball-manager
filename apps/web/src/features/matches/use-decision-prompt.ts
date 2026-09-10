'use client';
import { useEffect, useState } from 'react';

/** Let the completed play breathe before the coach prompt appears; playback is already stopped. */
export function useDecisionPrompt(
  cursor: number,
  paused: boolean,
  settled: boolean,
  critical: boolean,
) {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!paused || !settled || !critical) return;
    const timer = setTimeout(() => setShown(cursor), 850);
    return () => clearTimeout(timer);
  }, [cursor, paused, settled, critical]);
  return paused && (!settled || !critical || shown === cursor);
}
