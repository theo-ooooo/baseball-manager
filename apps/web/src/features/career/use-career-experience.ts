'use client';
import { useState } from 'react';
import { overall } from '@dugout/shared/game-view';
import {
  matchStakes,
  prospectGoals,
  prospectProgress,
  routineBriefing,
  type ProspectGoal,
} from '@dugout/shared/career-engagement';
import { importantCareerReport } from '@dugout/shared/career-pace';
import type { GameState } from '@dugout/shared/types';
import type { Act } from './game-contracts';
import { useWorld } from './world-context';
import { useUpcomingFixture } from '../matches/use-upcoming-fixture';
export function useCareerExperience(g: GameState, act: Act, busy: boolean) {
  const world = useWorld(),
    upcoming = useUpcomingFixture(g);
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(''),
    [goal, setGoal] = useState<ProspectGoal>('starts');
  const candidates = g.roster.filter((p) => p.age <= 23).sort((a, b) => overall(b) - overall(a));
  const player = candidates.find((p) => p.id === selected);
  const stories = (g.engagement?.prospects || []).filter((s) => s.club === g.club && s.active);
  const profiles = stories.map((story) => ({
    story,
    player: g.roster.find((p) => p.id === story.id),
    value: prospectProgress(story),
    goal: prospectGoals[story.goal],
  }));
  const opponent = (world.nextFixture(g) || upcoming?.pair)?.find((id) => id !== g.club);
  const stakes = opponent ? matchStakes(g, world, opponent) : undefined;
  return {
    open,
    setOpen,
    selected,
    goal,
    setGoal,
    candidates,
    player,
    profiles,
    stakes,
    existingGoal: g.engagement?.prospects.find((s) => s.id === selected && s.club === g.club)?.goal,
    briefing: routineBriefing(g, importantCareerReport),
    choose(id: string) {
      setSelected(id);
      setGoal(
        g.engagement?.prospects.find((s) => s.id === id && s.club === g.club)?.goal || 'starts',
      );
    },
    async follow() {
      if (busy || !player) return;
      const next = await act({ type: 'followProspect', id: player.id, goal });
      if (next) setOpen(false);
    },
    async unfollow(id: string) {
      if (!busy) await act({ type: 'unfollowProspect', id });
    },
  };
}
