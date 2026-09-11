'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';

export function useMatchCompletion(
  g: GameState,
  finished: boolean,
  cursor: number,
  busy: boolean,
  act: Act,
) {
  const attempted = useRef<string | null>(null);
  const router = useRouter();
  const live = g.liveMatch!;
  const key = `${live.playbackId}:${live.timelineVersion}`;
  useEffect(() => {
    if (!finished || busy || attempted.current === key) return;
    // Let a final commanded play's result remain readable before navigating away.
    const timer = setTimeout(
      () => {
        attempted.current = key;
        void act({ type: 'completeMatch', cursor, timelineVersion: live.timelineVersion }).then(
          (next) => {
            if (next && !next.liveMatch)
              router.push(
                '/?view=inbox&report=' +
                  encodeURIComponent(
                    next.news.find((n) => n.matchId === next.history[0]?.id)?.id || '',
                  ),
              );
          },
        );
      },
      live.timeline?.log.at(-1)?.play?.command ||
        live.timeline?.log.at(-1)?.play?.cards ||
        live.timeline?.log.at(-1)?.play?.augmentations
        ? 7000
        : 0,
    );
    return () => clearTimeout(timer);
  }, [finished, busy, key, cursor, live.timelineVersion, live.timeline, act, router]);
}
