import { prepareWorld } from './world-simulation';
import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import { createGameView, lineupAuto, overall, hash } from '@dugout/shared/game-view';
import { isAvailable } from '@dugout/shared/long-term';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { firstTeamLimit } from '@dugout/shared/roster-rules';
import { recallError } from '@dugout/shared/registrations';
import { prepareRegistrations, recordSquadMove, rememberRegistration } from './registration-log';

function poorForm(p: Player) {
  return p.pos === 'P'
    ? p.stats.g >= 3 && p.stats.outs >= 54 && (p.stats.er * 27) / p.stats.outs >= 6.5
    : p.stats.g >= 8 && p.stats.ab >= 40 && p.stats.h / p.stats.ab < 0.2;
}
function reserveForm(p: Player) {
  const s = p.reserveStats;
  return (
    !!s &&
    (p.pos === 'P' ? s.outs >= 18 && (s.er * 27) / s.outs <= 3.5 : s.ab >= 20 && s.h / s.ab >= 0.3)
  );
}
function performance(p: Player) {
  return p.pos === 'P'
    ? `${p.stats.g}경기 · ${`${Math.floor(p.stats.outs / 3)}.${p.stats.outs % 3}`}이닝 · ERA ${((p.stats.er * 27) / p.stats.outs).toFixed(2)}`
    : `${p.stats.g}경기 · ${p.stats.ab}타수 · 타율 ${(p.stats.h / p.stats.ab).toFixed(3)}`;
}
/** Reuses the fixture's already loaded roster; at most one exchange per club per three days. */
export function createAiRegistrations(world: WorldCatalog) {
  const view = createGameView(world);
  function prepare(g: GameState, club: string, review = true) {
    if (club === g.club && g.managerCareer?.status !== 'unemployed') return;
    prepareWorld(g);
    const state = prepareRegistrations(g),
      players = view.rosterFor(g, club);
    if (!players.length) return;
    let entry = state.clubs[club];
    if (!entry) {
      // Establish a baseline without inventing historic announcements or demotion dates.
      const saved = players.some((p) => p.squad === 'reserve');
      const ids = saved
        ? new Set(players.filter((p) => p.squad !== 'reserve').map((p) => p.id))
        : new Set(lineupAuto(players));
      if (!saved) {
        for (const p of [...players]
          .filter((p) => p.pos === 'P')
          .sort((a, b) => overall(b) - overall(a))
          .slice(0, 12))
          ids.add(p.id);
        for (const p of [...players].sort((a, b) => overall(b) - overall(a)))
          if (ids.size < firstTeamLimit(club)) ids.add(p.id);
      }
      for (const p of players) p.squad = ids.has(p.id) ? 'first' : 'reserve';
      entry = state.clubs[club] = { first: [...ids] };
    }
    const ids = new Set(entry.first);
    for (const p of players) p.squad = ids.has(p.id) ? 'first' : 'reserve';
    if (!review) return;
    const today = gameDate(g);
    const calledUp = players.some((p) => p.squad !== 'reserve' && p.internationalDuty);
    if (!calledUp && entry.reviewed && daysBetween(entry.reviewed, today) < 3) return;
    // Spread reviews across match dates. Ordinary post-appearance fatigue is never a demotion reason.
    if (!calledUp && !entry.reviewed && (g.day + hash(club)) % 3 !== 0) return;
    entry.reviewed = today;
    const reserve = players
      .filter(
        (p) => p.squad === 'reserve' && isAvailable(p) && p.condition >= 70 && !recallError(g, p),
      )
      .sort((a, b) => overall(b) - overall(a));
    const active = players.filter((p) => p.squad !== 'reserve');
    let outgoing: Player | undefined, incoming: Player | undefined;
    for (const p of active.sort(
      (a, b) =>
        Number(!!b.internationalDuty) - Number(!!a.internationalDuty) ||
        Number(!!b.injury) - Number(!!a.injury) ||
        overall(a) - overall(b),
    )) {
      if (
        p.internationalDuty ||
        (p.injury && !isAvailable(p) && daysBetween(today, p.injury.returnDate) >= 7) ||
        poorForm(p)
      ) {
        const candidate = reserve.find((x) => x.pos === p.pos);
        if (candidate) {
          outgoing = p;
          incoming = candidate;
          break;
        }
      }
    }
    if (!outgoing)
      for (const candidate of reserve.filter(reserveForm)) {
        const current = active.find(
          (p) => p.pos === candidate.pos && overall(candidate) >= overall(p) + 5 && !p.injury,
        );
        if (current) {
          outgoing = current;
          incoming = candidate;
          break;
        }
      }
    if (outgoing && incoming) {
      const reason = outgoing.internationalDuty
        ? `${outgoing.internationalDuty.name} 대표팀 차출 · ${outgoing.internationalDuty.returnDate} 복귀 예정`
        : outgoing.injury && !isAvailable(outgoing)
          ? `${outgoing.injury.name} 치료 · ${outgoing.injury.returnDate} 복귀 예정`
          : poorForm(outgoing)
            ? `성적 부진 재정비 · ${performance(outgoing)}`
            : `${incoming.name}의 2군 활약에 따른 같은 포지션 전력 조정`;
      recordSquadMove(g, outgoing, 'reserve', reason, 'club', true);
      recordSquadMove(
        g,
        incoming,
        'first',
        `${outgoing.name}의 공백을 메우는 같은 포지션 등록`,
        'club',
        true,
      );
      rememberRegistration(g, club, players);
    } else if (active.length < firstTeamLimit(club) && reserve.length) {
      const incoming = reserve[0];
      recordSquadMove(g, incoming, 'first', '1군 등록 공석 보충', 'club', true);
      rememberRegistration(g, club, players);
    }
  }
  return { prepare };
}
