'use client';
import { useEffect, useState } from 'react';
export type MatchWatchMode = 'full' | 'highlights';
export function rememberMatchWatchMode(mode: MatchWatchMode) {
  try {
    localStorage.setItem('dugout:watch-mode', mode);
  } catch {}
}
export function useMatchWatchMode() {
  const [mode, setMode] = useState<MatchWatchMode>(() => {
    try {
      return localStorage.getItem('dugout:watch-mode') === 'highlights' ? 'highlights' : 'full';
    } catch {
      return 'full';
    }
  });
  useEffect(() => rememberMatchWatchMode(mode), [mode]);
  return { mode, setMode };
}
