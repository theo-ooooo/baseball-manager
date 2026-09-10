'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Result } from '@dugout/shared/types';
import { replayScene } from '@dugout/shared/replay';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export function useArchivedReplay(result: Result) {
  const [index, setIndex] = useState(0),
    [playOverride, setPlaying] = useState<boolean | null>(null),
    [speed, setSpeed] = useState('1'),
    [run, setRun] = useState(0);
  const reduced = useReducedMotion(),
    playing = playOverride ?? !reduced;
  const last = Math.max(0, result.log.length - 1),
    event = result.log[index];
  const scene = useMemo(() => replayScene(result, index), [result, index]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (query.matches) setPlaying(false);
    };
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    query.addEventListener('change', change);
    document.addEventListener('visibilitychange', hide);
    return () => {
      query.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  function jump(value: number) {
    setIndex(Math.max(0, Math.min(last, value)));
    setRun((n) => n + 1);
  }
  return {
    index,
    run,
    last,
    event,
    scene,
    playing,
    reduced,
    speed,
    setSpeed,
    setPlaying,
    jump,
    innings: Array.from(new Set(result.log.map((e) => e.inning))),
    finished: index === last && !playing,
    onEnd() {
      if (index < last) setIndex((n) => n + 1);
      else setPlaying(false);
    },
  };
}
