'use client';
import { useCallback, useEffect, useState } from 'react';

function savedCursor(key: string, floor: number, length: number) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isInteger(n) ? Math.max(floor, Math.min(length, n)) : floor;
  } catch {
    return floor;
  }
}
export function useMatchPlayback(key: string, floor: number, length: number, busy: boolean) {
  const [state, setState] = useState<{
    cursor: number;
    phase: 'settled' | 'playing' | 'paused';
    continuous: boolean;
  }>(() => ({
    cursor: savedCursor(key, floor, length),
    phase: 'settled',
    continuous: false,
  }));
  const pause = useCallback(
    () =>
      setState((previous) => ({
        ...previous,
        phase: previous.phase === 'playing' ? 'paused' : previous.phase,
        continuous: false,
      })),
    [],
  );
  const play = useCallback(
    (continuous = true) =>
      setState((previous) => {
        if (previous.phase === 'settled' && previous.cursor >= length) return previous;
        return {
          cursor: previous.cursor + (previous.phase === 'settled' ? 1 : 0),
          phase: 'playing',
          continuous,
        };
      }),
    [length],
  );
  const finishPlay = useCallback(
    () =>
      setState((previous) =>
        previous.phase !== 'playing'
          ? previous
          : {
              ...previous,
              phase: 'settled',
              continuous: previous.continuous && previous.cursor < length,
            },
      ),
    [length],
  );
  const [speed, setSpeed] = useState(() => {
    try {
      const value = localStorage.getItem('dugout:match-speed');
      return value && ['1', '2', '4', '8'].includes(value) ? value : '1';
    } catch {
      return '1';
    }
  });
  useEffect(() => {
    // Only persist completed plays: a refresh during a pitch must not consume its result.
    const consumed = state.cursor - (state.phase === 'settled' ? 0 : 1);
    try {
      localStorage.setItem(key, String(Math.max(floor, consumed)));
    } catch {
      /* Optional storage. */
    }
  }, [key, floor, state.cursor, state.phase]);
  useEffect(() => {
    try {
      localStorage.setItem('dugout:match-speed', speed);
    } catch {
      /* Optional storage. */
    }
  }, [speed]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [pause]);
  useEffect(() => {
    if (!state.continuous || state.phase !== 'settled' || busy) return;
    const timer = setTimeout(() => play(), 1000 / Number(speed));
    return () => clearTimeout(timer);
  }, [state.continuous, state.phase, state.cursor, speed, busy, play]);
  return {
    ...state,
    speed,
    setSpeed,
    playing: state.phase === 'playing' || state.continuous,
    animating: state.phase === 'playing' && !busy,
    settled: state.phase === 'settled',
    finished: state.cursor >= length && state.phase === 'settled',
    play,
    pause,
    finishPlay,
  };
}
