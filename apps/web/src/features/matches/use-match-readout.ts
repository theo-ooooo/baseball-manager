'use client';
import { useMemo } from 'react';
import type { GameState, Result } from '@dugout/shared/types';
import { matchReadout } from './match-readout';
export function useMatchReadout(result: Result, cursor: number, g?: GameState) {
  const changes = g?.liveMatch?.changes,
    club = g?.club;
  return useMemo(
    () => matchReadout(result, cursor, club ? (result.home === club ? 1 : 0) : undefined, changes),
    [result, cursor, club, changes],
  );
}
