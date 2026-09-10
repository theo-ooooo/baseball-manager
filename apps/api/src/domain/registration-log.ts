import type { GameState, Player } from '@dugout/shared/types';
import type { RegistrationEvent } from '@dugout/shared/registrations';
import { recallWaitingDays } from '@dugout/shared/registrations';
import { addDays, gameDate } from '@dugout/shared/calendar';
export function prepareRegistrations(g: GameState) {
  return (g.registrations ??= { serial: 0, events: [], recalls: {}, clubs: {} });
}
export function rememberRegistration(g: GameState, club = g.club, players = g.roster) {
  const state = prepareRegistrations(g);
  state.clubs[club] = {
    ...state.clubs[club],
    first: players.filter((p) => p.squad !== 'reserve').map((p) => p.id),
  };
}
export function recordSquadMove(
  g: GameState,
  p: Player,
  to: 'first' | 'reserve',
  reason: string,
  source: RegistrationEvent['source'] = 'manager',
  regular = g.phase === 'regular',
) {
  const from = p.squad || 'first';
  if (from === to) return;
  const state = prepareRegistrations(g),
    today = gameDate(g);
  p.squad = to;
  const days = regular && to === 'reserve' ? recallWaitingDays(p) : 0;
  const eligible = days ? addDays(today, days) : undefined;
  if (eligible) state.recalls[p.id] = { club: p.club, demoted: today, eligible, days };
  else if (to === 'first') delete state.recalls[p.id];
  state.events.unshift({
    id: `registration-${state.serial++}`,
    date: today,
    club: p.club,
    playerId: p.id,
    name: p.name,
    pos: p.pos,
    from,
    to,
    reason,
    source,
    eligible,
  });
  state.events = state.events.filter((e) => e.date >= addDays(today, -30)).slice(0, 600);
  for (const [id, recall] of Object.entries(state.recalls))
    if (recall.eligible < addDays(today, -30)) delete state.recalls[id];
  const entry = state.clubs[p.club];
  if (entry)
    entry.first =
      to === 'first'
        ? [...entry.first.filter((id) => id !== p.id), p.id]
        : entry.first.filter((id) => id !== p.id);
}
