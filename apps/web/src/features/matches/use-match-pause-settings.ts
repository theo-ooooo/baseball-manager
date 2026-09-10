'use client';
import { useState } from 'react';
export type MatchPauseSettings = { opportunity: boolean; threat: boolean };
const key = 'dugout:match-auto-pause';
export function useMatchPauseSettings() {
  const [settings, setSettings] = useState<MatchPauseSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return { opportunity: saved.opportunity !== false, threat: saved.threat !== false };
    } catch {
      return { opportunity: true, threat: true };
    }
  });
  const toggle = (kind: keyof MatchPauseSettings, checked: boolean) => {
    const next = { ...settings, [kind]: checked };
    setSettings(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Storage may be unavailable. */
    }
  };
  return { settings, toggle };
}
