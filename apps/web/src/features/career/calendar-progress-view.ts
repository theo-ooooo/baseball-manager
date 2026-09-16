import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';

export type CalendarJourney = {
  year: number;
  club: string;
  phase: GameState['phase'];
  start: number;
  day: number;
  limit: number;
  status: string;
  running: boolean;
};

export function visibleCalendarJourney(journey: CalendarJourney | null, g: GameState | null) {
  if (!journey || !g || journey.year !== g.year || journey.club !== g.club) return null;
  if (!journey.running && (journey.day !== g.day || journey.phase !== g.phase)) return null;
  return journey;
}

export function calendarDayResults(g: GameState, day: number) {
  const date = gameDate(g, day);
  return g.history.filter(
    (r) => (r.date || gameDate(g, r.day)) === date && [r.home, r.away].includes(g.club),
  );
}
