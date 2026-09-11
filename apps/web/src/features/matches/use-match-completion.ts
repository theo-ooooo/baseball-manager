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
    // Complete on the next task, independently of any result notice still on screen.
    const timer = setTimeout(() => {
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
    }, 0);
    return () => clearTimeout(timer);
  }, [finished, busy, key, cursor, live.timelineVersion, act, router]);
}
