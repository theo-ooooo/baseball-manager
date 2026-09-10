'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addDays, daysBetween, gameDate } from '@dugout/shared/calendar';
import type { GameState, Player } from '@dugout/shared/types';
import {
  trainingCenterFor,
  trainingMonday,
  trainingDay,
  reserveTrainingMatch,
  playerTrainingDay,
  trainingTemplates,
  type TrainingSquad,
  type TrainingTemplate,
  type TrainingSlots,
  type TrainingSession,
} from '@dugout/shared/training-center';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';

export function useTrainingCenter(g: GameState, act: Act, busy: boolean) {
  const world = useWorld();
  const center = trainingCenterFor(g),
    today = gameDate(g);
  const [tab, setTab] = useState<'schedule' | 'individual' | 'staff' | 'rest'>('schedule');
  const [squad, setSquad] = useState<TrainingSquad>('first');
  const [week, setWeek] = useState(0);
  const [draft, setDraft] = useState<Record<string, TrainingSlots>>({});
  const [template, setTemplate] = useState<TrainingTemplate | null>(null);
  const [selected, setSelected] = useState<{ date: string; slot: number } | null>(null);
  const [query, setQuery] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [restBelow, setRestBelow] = useState(center.restBelow);
  const [lightBelow, setLightBelow] = useState(center.lightBelow);
  const [coaches, setCoaches] = useState(center.coaches);
  const [responsibility, setResponsibility] = useState(center.responsibility);
  const blocked = busy || !!g.liveMatch;
  const dirty = Object.keys(draft).length > 0 || template !== null;
  const activeTemplate = template ?? center.programs[squad].template;
  const calendar = useMemo(() => {
    const config = trainingCenterFor(g);
    const fixture = (date: string, group: TrainingSquad) => {
      const day = g.day + daysBetween(gameDate(g), date);
      const state = {
        ...g,
        day,
        phase: g.phase === 'preseason' && day >= 0 ? ('regular' as const) : g.phase,
      };
      if (group === 'reserve') return reserveTrainingMatch(state) ? '2군 연습경기' : null;
      const past = g.history.find(
        (m) => (m.date || gameDate(g, m.day)) === date && (m.home === g.club || m.away === g.club),
      );
      const pair = past ? [past.home, past.away] : world.nextFixture(state);
      const opponent = pair?.find((id) => id !== g.club);
      return opponent ? `${world.getClub(opponent).short}전` : null;
    };
    const day = (date: string, group: TrainingSquad) => {
      const opponent = fixture(date, group);
      return {
        ...trainingDay(g, group, date, !!opponent, !!fixture(addDays(date, -1), group), config),
        opponent,
      };
    };
    const start = addDays(trainingMonday(gameDate(g)), week * 7);
    return {
      days: Array.from({ length: 7 }, (_, i) => day(addDays(start, i), squad)),
      today: { first: day(gameDate(g), 'first'), reserve: day(gameDate(g), 'reserve') },
    };
  }, [g, squad, week, world]);
  const days = calendar.days.map((day) => ({ ...day, slots: draft[day.date] ?? day.slots }));
  const allPlayers = useMemo(
    () =>
      g.roster.map((p) => ({
        p,
        training: playerTrainingDay(
          g,
          p,
          calendar.today[p.squad === 'reserve' ? 'reserve' : 'first'],
        ),
      })),
    [g, calendar],
  );
  const players = allPlayers.filter(
    ({ p }) => (p.squad === 'reserve') === (squad === 'reserve') && p.name.includes(query.trim()),
  );
  const applyTemplate = (value: TrainingTemplate) => {
    setTemplate(value);
    setDraft(
      Object.fromEntries(
        calendar.days
          .filter((d) => d.date >= today && d.date <= addDays(today, 27))
          .map((d) => [
            d.date,
            d.match
              ? (['tactics', 'match', 'recovery'] as TrainingSlots)
              : ([...trainingTemplates[value].slots] as TrainingSlots),
          ]),
      ),
    );
  };
  const saveSchedule = async () => {
    if (blocked) return;
    const next = await act({
      type: 'setTrainingSchedule',
      squad,
      template: activeTemplate,
      days: draft,
    });
    if (next) {
      setDraft({});
      setTemplate(null);
      toast.success('주간 훈련 계획을 저장했습니다. 날짜 진행 시 적용됩니다.');
    }
  };
  return {
    center,
    today,
    tab,
    setTab,
    squad,
    setSquad: (value: TrainingSquad) => {
      if (!dirty) setSquad(value);
    },
    week,
    setWeek,
    days,
    blocked,
    dirty,
    activeTemplate,
    applyTemplate,
    selected,
    setSelected,
    chooseSession: (session: TrainingSession) => {
      if (!selected || blocked) return;
      const day = days.find((d) => d.date === selected.date);
      if (!day || day.date < today || (day.match && selected.slot === 1)) return;
      const slots: TrainingSlots = [...day.slots];
      slots[selected.slot] = session;
      setDraft((previous) => ({ ...previous, [day.date]: slots }));
      setSelected(null);
    },
    saveSchedule,
    discard: () => {
      setDraft({});
      setTemplate(null);
    },
    query,
    setQuery,
    players,
    player: g.roster.find((p) => p.id === playerId),
    openPlayer: (p: Player) => setPlayerId(p.id),
    closePlayer: () => setPlayerId(null),
    overview: {
      rest: allPlayers.filter((x) => x.training.rest).length,
      heavy: allPlayers.filter((x) => x.training.load > 3).length,
      average:
        allPlayers.reduce((sum, x) => sum + x.training.load, 0) / Math.max(1, allPlayers.length),
    },
    restBelow,
    setRestBelow,
    lightBelow,
    setLightBelow,
    saveRest: async () => {
      if (blocked) return;
      if (await act({ type: 'setTrainingRest', restBelow, lightBelow }))
        toast.success('컨디션별 자동 휴식 기준을 저장했습니다.');
    },
    coaches,
    setCoaches,
    responsibility,
    setResponsibility,
    saveStaff: async () => {
      if (blocked) return;
      if (await act({ type: 'setTrainingStaff', responsibility, coaches }))
        toast.success('훈련 담당을 저장했습니다.');
    },
  };
}
export type TrainingCenterView = ReturnType<typeof useTrainingCenter>;
