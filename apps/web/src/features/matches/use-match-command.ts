'use client';
import { useMemo, useRef, useState } from 'react';
import { coachBattingCommand } from './coach-batting-command';
import type { GameState } from '@dugout/shared/types';
import {
  matchCommandOptions,
  nextMatchHalf,
  previousMatchCommand,
  type MatchCommandKind,
} from '@dugout/shared/match-commands';
import type { Act } from '../career/game-contracts';
import { requestMatchResume } from './use-match-resume';

export function useMatchCommand(g: GameState, cursor: number, busy: boolean, act: Act) {
  const live = g.liveMatch!;
  const queued = live.commands?.find((command) => command.cursor === cursor)?.kind;
  const [selected, setSelected] = useState<MatchCommandKind | undefined>(queued);
  const submitting = useRef(false);
  const recommendation = useMemo(() => coachBattingCommand(g, cursor), [g, cursor]);
  const options = matchCommandOptions(live, g.club, cursor);
  const defending = nextMatchHalf(live, cursor) !== (live.home === g.club ? 1 : 0);
  const error = options.find((option) => option.kind === selected)?.reason;
  return {
    recommendation,
    previous: previousMatchCommand(live, g.club, cursor),
    selected,
    setSelected,
    queued,
    options,
    defending,
    confirm: async () => {
      if (busy || submitting.current || !selected || error || selected === queued) return;
      submitting.current = true;
      try {
        await sendMatchCommand(g, cursor, selected, act);
      } finally {
        submitting.current = false;
      }
    },
  };
}

export async function sendMatchCommand(
  g: GameState,
  cursor: number,
  command: MatchCommandKind,
  act: Act,
) {
  const live = g.liveMatch!;
  if (matchCommandOptions(live, g.club, cursor).find((o) => o.kind === command)?.reason) return;
  const cancelResume = requestMatchResume(live);
  try {
    const next = await act({
      type: 'matchCommand',
      command,
      cursor,
      timelineVersion: live.timelineVersion,
    });
    if (!next) cancelResume();
  } catch (error) {
    cancelResume();
    throw error;
  }
}
