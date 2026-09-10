'use client';
import { useEffect, useState } from 'react';
import type { LiveMatch } from '@dugout/shared/types';

// Tab-local playback intent only; server match state remains authoritative.
const requests = new Set<string>();
const keyFor = (live: LiveMatch, version = live.timelineVersion) => `${live.playbackId}:${version}`;
export function requestMatchResume(live: LiveMatch) {
  const key = keyFor(live, (live.timelineVersion || 0) + 1);
  requests.add(key);
  return () => requests.delete(key);
}
export function useMatchResume(live: LiveMatch) {
  const key = keyFor(live);
  const [resume] = useState(() => requests.has(key));
  useEffect(() => {
    requests.delete(key);
  }, [key]);
  return resume;
}
