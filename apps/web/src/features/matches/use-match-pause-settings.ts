'use client';
import { useMemo, useSyncExternalStore } from 'react';
export type MatchPauseSettings = { opportunity: boolean; threat: boolean };
const key = 'dugout:match-auto-pause';
const changed = 'dugout:match-auto-pause-changed';
let fallback = '{}';
let storageUnavailable = false;
function snapshot() {
  if (storageUnavailable) return fallback;
  try {
    return localStorage.getItem(key) || '{}';
  } catch {
    return fallback;
  }
}
function parse(raw: string): MatchPauseSettings {
  try {
    const saved = JSON.parse(raw);
    return { opportunity: saved?.opportunity !== false, threat: saved?.threat !== false };
  } catch {
    return { opportunity: true, threat: true };
  }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify();
  };
  window.addEventListener('storage', storage);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(changed, notify);
  };
}
function toggle(kind: keyof MatchPauseSettings, checked: boolean) {
  // Read the same current source as playback, including two changes in one frame.
  fallback = JSON.stringify({ ...parse(snapshot()), [kind]: checked });
  try {
    localStorage.setItem(key, fallback);
  } catch {
    /* Keep the setting for this tab when storage is unavailable. */
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(changed));
}
function enabled(kind: keyof MatchPauseSettings) {
  return parse(snapshot())[kind];
}
export function useMatchPauseSettings() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '{}');
  return useMemo(() => {
    const settings = parse(raw);
    const label = settings.opportunity
      ? settings.threat
        ? '득점 기회 · 실점 위기에서 정지'
        : '득점 기회에서만 정지'
      : settings.threat
        ? '실점 위기에서만 정지'
        : '자동 정지 꺼짐 · 계속 진행';
    return { settings, toggle, enabled, label };
  }, [raw]);
}
