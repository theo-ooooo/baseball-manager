'use client';
import { useEffect, useRef, useState } from 'react';
import type { Result } from '@dugout/shared/types';

export function useMatchEffects(result: Result, consumed: number, active: boolean) {
  const seen = useRef(consumed);
  const [event, setEvent] = useState<Result['log'][number]>();
  useEffect(() => {
    if (!active) return;
    const fresh = result.log
      .slice(seen.current, consumed)
      .findLast((entry) => entry.play?.cards || entry.play?.augmentations);
    const timer = setTimeout(() => {
      seen.current = Math.max(seen.current, consumed);
      if (fresh) setEvent(fresh);
    }, 0);
    return () => clearTimeout(timer);
  }, [result, consumed, active]);
  useEffect(() => {
    if (!event || !active) return;
    const timer = setTimeout(() => setEvent(undefined), 7000);
    return () => clearTimeout(timer);
  }, [event, active]);
  return { event, dismiss: () => setEvent(undefined) };
}
