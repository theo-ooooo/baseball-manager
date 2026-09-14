'use client';
import { useState } from 'react';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import type { CompetitionChoice } from '@dugout/shared/lineup-competition';
import type { GameState } from '@dugout/shared/types';
import type { Act } from './game-contracts';
export function useLineupCompetition(g: GameState, act: Act, busy: boolean, id?: string) {
  const [opened, setOpened] = useState<string>(),
    [choice, setChoice] = useState<CompetitionChoice>('compete');
  const cases = (g.engagement?.competitions || []).filter((c) => c.club === g.club);
  const story = id
    ? cases.find((c) => c.id === id)
    : cases.find((c) => c.status !== 'resolved') || cases.at(-1);
  const canAnswer =
    !busy &&
    !g.liveMatch &&
    !isClubSeasonRest(g) &&
    g.managerCareer?.status === 'employed' &&
    !g.managerCareer.vacationUntil;
  const mediatorAvailable =
    !!story?.mediator &&
    g.roster.some(
      (p) =>
        p.id === story.mediator!.id && p.squad !== 'reserve' && !p.injury && !p.internationalDuty,
    );
  return {
    story,
    choice,
    setChoice,
    mediatorAvailable,
    canAnswer,
    paused:
      !!story &&
      [story.veteran.id, story.prospect.id].some((id) =>
        g.roster.some((p) => p.id === id && (p.injury || p.internationalDuty)),
      ),
    open: !!story && opened === story.id && story.status === 'decision',
    setOpen(value: boolean) {
      setOpened(value ? story?.id : undefined);
      if (value) setChoice('compete');
    },
    async submit() {
      if (
        !story ||
        story.status !== 'decision' ||
        !canAnswer ||
        (choice === 'mediate' && !mediatorAvailable)
      )
        return;
      const next = await act({ type: 'respondCompetition', id: story.id, choice });
      if (next) setOpened(undefined);
    },
  };
}
