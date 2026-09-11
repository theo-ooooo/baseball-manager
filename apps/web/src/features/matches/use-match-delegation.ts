'use client';
import { useRouter } from 'next/navigation';
import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
export function useMatchDelegation(
  g: GameState,
  act: Act,
  busy: boolean,
  cursor?: number,
  onStart?: () => void,
) {
  const router = useRouter();
  const coach =
    g.staff.find(
      (c) => c.role === '수석' && (c.contractUntil === undefined || c.contractUntil > g.year),
    ) ||
    g.staff.find(
      (c) => c.role !== '스카우트' && (c.contractUntil === undefined || c.contractUntil > g.year),
    );
  return {
    coach,
    delegate: async () => {
      if (busy || !coach) return;
      onStart?.();
      const next = await act({
        type: 'delegateMatch',
        date: gameDate(g),
        ...(g.liveMatch
          ? {
              cursor: cursor ?? g.liveMatch.cursor,
              timelineVersion: g.liveMatch.timelineVersion,
              playbackId: g.liveMatch.playbackId,
            }
          : {}),
      });
      if (next && !next.liveMatch)
        router.push(
          '/?view=inbox&report=' +
            encodeURIComponent(next.news.find((n) => n.matchId === next.history[0]?.id)?.id || ''),
        );
    },
  };
}
