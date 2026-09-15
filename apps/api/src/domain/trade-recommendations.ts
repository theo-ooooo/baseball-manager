import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import type { TradeSuggestion } from '@dugout/shared/trade-recommendations';
import { createGameView, overall } from '@dugout/shared/game-view';
import {
  assessTradeReturn,
  playerClubStanding,
  tradePackageValue,
} from '@dugout/shared/trade-policy';
import { isActiveTrade, tradeCanRevise } from '@dugout/shared/trade-status';
import { transfersBlocked } from '@dugout/shared/management';
import { tradeWindow } from '@dugout/shared/trade-window';
import { createTrades } from './trades';
import { createDeadlineMarket } from './deadline-market';
export function recommendTrades(g: GameState, world: WorldCatalog, input: Record<string, unknown>) {
  const view = createGameView(world),
    trades = createTrades(world),
    deadline = createDeadlineMarket(world);
  if (
    g.managerCareer?.status === 'unemployed' ||
    g.managerCareer?.vacationUntil ||
    g.liveMatch ||
    transfersBlocked(g) ||
    tradeWindow(g, view.getClub(g.club).league).closed
  )
    throw new Error('현재는 트레이드 협상을 진행할 수 없습니다.');
  const offer =
    input.offerId === undefined ? undefined : g.trades?.find((o) => o.id === input.offerId);
  if (input.offerId !== undefined && (!offer || !tradeCanRevise(g, offer)))
    throw new Error('수정 가능한 협상을 선택해 주세요.');
  const club = offer?.club || (input.club ? String(input.club) : undefined);
  const clubs = world.clubs.filter(
    (c) => c.id !== g.club && c.league === view.getClub(g.club).league && (!club || c.id === club),
  );
  if (!clubs.length) throw new Error('같은 리그의 협상 구단을 선택해 주세요.');
  const incoming =
    input.incoming === undefined ? offer?.counterIncoming || offer?.incoming : input.incoming;
  if (
    incoming !== undefined &&
    (!Array.isArray(incoming) ||
      incoming.length > 3 ||
      incoming.some((id) => typeof id !== 'string') ||
      new Set(incoming).size !== incoming.length)
  )
    throw new Error('받을 선수는 서로 다른 1~3명을 선택해 주세요.');
  const reserved = new Set(
    (g.trades || [])
      .filter((o) => o.id !== offer?.id && isActiveTrade(g, o))
      .flatMap((o) => [
        ...o.outgoing,
        ...o.incoming,
        ...(o.counterOutgoing || []),
        ...(o.counterIncoming || []),
      ]),
  );
  const own = g.roster.filter(
    (p) =>
      !reserved.has(p.id) &&
      !p.injury &&
      !p.internationalDuty &&
      !['franchise', 'core'].includes(playerClubStanding(p, g.roster).tier),
  );
  const baseline = (p: Player) => {
    const row = g.roster
      .filter((v) => v.pos === p.pos && v.squad !== 'reserve')
      .sort((a, b) => overall(b) - overall(a));
    return overall(
      row[Math.min(row.length, { P: 5, C: 1, IF: 4, OF: 3, DH: 1 }[p.pos]) - 1] ||
        g.roster.find((v) => v.pos === p.pos) ||
        p,
    );
  };
  const pools = clubs.map((c) => ({ club: c.id, roster: view.rosterFor(g, c.id) }));
  let targets: { club: string; roster: Player[]; players: Player[] }[];
  if (Array.isArray(incoming) && incoming.length) {
    const pool = pools.find((x) => incoming.every((id) => x.roster.some((p) => p.id === id)));
    if (!pool) throw new Error('받을 선수의 현재 소속을 확인해 주세요.');
    targets = [{ ...pool, players: incoming.map((id) => pool.roster.find((p) => p.id === id)!) }];
  } else {
    targets = pools
      .flatMap((pool) =>
        pool.roster
          .filter(
            (p) =>
              !p.injury &&
              !p.internationalDuty &&
              !reserved.has(p.id) &&
              playerClubStanding(p, pool.roster).tier !== 'franchise' &&
              (overall(p) > baseline(p) || (p.age <= 24 && overall(p) >= baseline(p) - 3)),
          )
          .sort(
            (a, b) =>
              overall(b) - baseline(b) - (overall(a) - baseline(a)) || a.id.localeCompare(b.id),
          )
          .slice(0, 2)
          .map((p) => ({ ...pool, players: [p] })),
      )
      .sort(
        (a, b) =>
          overall(b.players[0]) -
          baseline(b.players[0]) -
          overall(a.players[0]) +
          baseline(a.players[0]),
      )
      .slice(0, 12);
  }
  const suggestions: (TradeSuggestion & { score: number })[] = [];
  for (const target of targets) {
    if (target.players.some((p) => reserved.has(p.id) || p.injury || p.internationalDuty)) continue;
    const listed =
      g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year
        ? g.deadlineMarket.listings.find(
            (l) => l.status === 'open' && target.players.some((p) => p.id === l.player.id),
          )
        : undefined;
    if (listed && (target.players.length !== 1 || listed.seller !== target.club)) continue;
    if (offer?.deadline && listed?.id !== offer.deadline.id) continue;
    let rivalValue: number | undefined;
    if (listed) {
      try {
        deadline.requireOpen(g, listed.id);
      } catch {
        continue;
      }
      const rival = view
        .rosterFor(g, listed.rival.club)
        .find((p) => p.id === listed.rival.player.id);
      if (!rival) continue;
      rivalValue = tradePackageValue(
        target.roster,
        [rival],
        target.players,
        listed.rival.cash,
      ).total;
    }
    const primary = target.players[0],
      targetLevel = Math.max(...target.players.map(overall));
    const candidates = [...own]
      .sort(
        (a, b) =>
          Number(b.pos === primary.pos) - Number(a.pos === primary.pos) ||
          Math.abs(overall(a) - targetLevel) - Math.abs(overall(b) - targetLevel) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 14);
    const sets = candidates.map((p) => [p]);
    const bench = candidates
      .filter((p) => !g.lineup.includes(p.id) && p.id !== g.starter)
      .slice(0, 6);
    for (let i = 0; i < bench.length; i++)
      for (let j = i + 1; j < bench.length; j++) sets.push([bench[i], bench[j]]);
    for (const outgoing of sets) {
      const assessed = assessTradeReturn(target.roster, outgoing, target.players, 0);
      if (assessed.status === 'rejected') continue;
      let cash = assessed.status === 'counter' ? assessed.cash : 0;
      if (rivalValue !== undefined) {
        const value = tradePackageValue(target.roster, outgoing, target.players, cash);
        cash = Math.max(cash, Math.ceil(rivalValue - value.players));
        if (tradePackageValue(target.roster, outgoing, target.players, cash).total < rivalValue)
          continue;
      }
      try {
        trades.validate(g, {
          club: target.club,
          incoming: target.players.map((p) => p.id),
          outgoing: outgoing.map((p) => p.id),
          cash,
        });
      } catch {
        continue;
      }
      if (assessTradeReturn(target.roster, outgoing, target.players, cash).status !== 'accepted')
        continue;
      const starters = outgoing.filter((p) => g.lineup.includes(p.id) || g.starter === p.id);
      const rank = overall(primary) - baseline(primary);
      const snapshot = (p: Player) => ({ id: p.id, name: p.name, pos: p.pos, age: p.age });
      suggestions.push({
        club: target.club,
        incoming: target.players.map(snapshot),
        outgoing: outgoing.map(snapshot),
        cash,
        deadlineId: listed?.id,
        reason:
          rank > 0
            ? `${primary.name} 선수로 ${primary.pos}의 현재 전력을 보강하는 안입니다.`
            : `${primary.name} 선수의 나이와 현재 전력을 고려한 교환안입니다.`,
        cost: starters.length
          ? `${starters.map((p) => p.name).join('·')} 선수가 현재 선발 명단에 있어 빈자리를 채워야 합니다.`
          : `현재 선발 명단을 유지하면서 ${outgoing.map((p) => p.name).join('·')} 선수를 교환하는 안입니다.`,
        score:
          rank * 4 -
          starters.length * 25 -
          outgoing.length * 5 -
          cash / 50 -
          outgoing.reduce((sum, p) => sum + overall(p), 0) / 15,
      });
    }
  }
  suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.cash - b.cash ||
      a.outgoing
        .map((p) => p.id)
        .join()
        .localeCompare(b.outgoing.map((p) => p.id).join()),
  );
  const result: TradeSuggestion[] = [],
    usedTargets = new Map<string, number>();
  for (const s of suggestions) {
    const key = s.incoming.map((p) => p.id).join();
    if ((usedTargets.get(key) || 0) >= (targets.length === 1 ? 3 : 1)) continue;
    usedTargets.set(key, (usedTargets.get(key) || 0) + 1);
    result.push({
      club: s.club,
      incoming: s.incoming,
      outgoing: s.outgoing,
      cash: s.cash,
      reason: s.reason,
      cost: s.cost,
      deadlineId: s.deadlineId,
    });
    if (result.length === 3) break;
  }
  return result;
}
