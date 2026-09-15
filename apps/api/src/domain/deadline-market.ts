import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import { deadlineCountdown, type DeadlineListing } from '@dugout/shared/deadline-market';
import {
  assessTradeReturn,
  playerClubStanding,
  tradePackageValue,
} from '@dugout/shared/trade-policy';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { createGameView, overall, teamBudget } from '@dugout/shared/game-view';
import { transfersBlocked } from '@dugout/shared/management';
import { archivePlayer, prepareWorld, saveWorldPlayer, worldEvent } from './world-simulation';
import { postNews } from './club-dynamics';
const active = (o: TradeOffer) => ['pending', 'accepted', 'counter'].includes(o.status);

export function createDeadlineMarket(world: WorldCatalog) {
  const view = createGameView(world),
    catalogIds = new Set(world.players.map((p) => p.id));
  const balance = (g: GameState, club: string) =>
    g.simulation?.clubs[club]?.balance ?? teamBudget(view.getClub(club).league);
  function reserved(g: GameState) {
    return new Set([
      ...(g.trades || [])
        .filter(active)
        .flatMap((o) => [
          ...o.incoming,
          ...o.outgoing,
          ...(o.counterIncoming || []),
          ...(o.counterOutgoing || []),
        ]),
      ...g.deals
        .filter((d) => !['withdrawn', 'expired', 'rejected'].includes(d.status))
        .map((d) => d.player.id),
      ...(g.deadlineMarket?.listings || [])
        .filter((l) => l.status === 'open')
        .flatMap((l) => [l.player.id, l.rival.player.id]),
    ]);
  }
  function prepare(g: GameState) {
    if (
      g.liveMatch ||
      g.managerCareer?.status !== 'employed' ||
      g.managerCareer.vacationUntil ||
      transfersBlocked(g)
    )
      return;
    const league = view.getClub(g.club).league,
      window = deadlineCountdown(g, league);
    if (
      !window.active ||
      !window.date ||
      window.remaining! < 1 ||
      (g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year)
    )
      return;
    prepareWorld(g);
    const today = gameDate(g),
      closes = [addDays(today, 3), window.date].sort()[0];
    const table = view.standings(g, league),
      teams = table.map((r) => r.club),
      unavailable = reserved(g);
    const rosters = new Map(
      teams.filter((id) => id !== g.club).map((id) => [id, view.rosterFor(g, id)]),
    );
    const listings: DeadlineListing[] = [];
    // Bounded search: four sellers, three targets each, four competing clubs, eight return players.
    for (const seller of teams
      .slice(Math.floor(teams.length / 2))
      .reverse()
      .filter((id) => id !== g.club)
      .slice(0, 4)) {
      const roster = rosters.get(seller)!;
      const targets = roster
        .filter(
          (p) =>
            p.age >= 26 &&
            !p.injury &&
            !p.internationalDuty &&
            !unavailable.has(p.id) &&
            ['starter', 'depth'].includes(playerClubStanding(p, roster).tier),
        )
        .sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
        .slice(0, 3);
      for (const target of targets) {
        let listing: DeadlineListing | undefined;
        for (const buyer of teams.filter((id) => id !== g.club && id !== seller).slice(0, 4)) {
          const buyers = rosters.get(buyer)!,
            peers = buyers
              .filter((p) => p.pos === target.pos)
              .sort((a, b) => overall(b) - overall(a));
          const need =
            peers[Math.min(peers.length - 1, { P: 4, C: 0, IF: 3, OF: 2, DH: 0 }[target.pos])];
          if (!need || overall(target) <= overall(need) + 1) continue;
          const returns = buyers
            .filter(
              (p) =>
                p.pos === target.pos &&
                p.id !== need.id &&
                !p.injury &&
                !p.internationalDuty &&
                !unavailable.has(p.id) &&
                playerClubStanding(p, buyers).tier !== 'franchise',
            )
            .sort((a, b) => overall(a) - overall(b) || a.id.localeCompare(b.id))
            .slice(-8);
          for (const offered of returns) {
            // A competing club must improve its immediate rotation, not sell a better starter for no reason.
            if (overall(offered) > overall(target) + 1) continue;
            const assessment = assessTradeReturn(roster, [offered], [target], 0);
            if (assessment.status === 'rejected') continue;
            const cash = assessment.status === 'counter' ? assessment.cash : 0;
            if (cash > balance(g, buyer) || cash > teamBudget(league) * 0.08) continue;
            listing = {
              id: `deadline:${g.year}:${g.club}:${target.id}`,
              seller,
              player: { id: target.id, name: target.name, pos: target.pos, age: target.age },
              rival: { club: buyer, player: { id: offered.id, name: offered.name }, cash },
              opened: today,
              closes,
              status: 'open',
            };
            break;
          }
          if (listing) break;
        }
        if (listing) {
          listings.push(listing);
          unavailable.add(target.id);
          unavailable.add(listing.rival.player.id);
          break;
        }
      }
      if (listings.length >= 3) break;
    }
    g.deadlineMarket = { club: g.club, year: g.year, opened: today, listings };
    if (listings.length)
      postNews(
        g,
        '트레이드 마감 임박 · 경쟁 구단이 움직입니다',
        `${listings.map((l) => `${l.player.name}에 ${view.getClub(l.rival.club).name}이 선수 교환을 제안했습니다.`).join('\n')}\n매각 결정일로 날짜를 넘기기 전에 조건을 제안하고 최종 확정하세요.`,
        'transfer',
        { id: `deadline-open:${g.year}:${g.club}`, actionView: 'trade', priority: 'urgent' },
      );
  }
  function find(g: GameState, id: unknown) {
    return g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year
      ? g.deadlineMarket.listings.find((l) => l.id === id)
      : undefined;
  }
  function valid(g: GameState, l: DeadlineListing) {
    if (g.phase !== 'regular' || deadlineCountdown(g, view.getClub(l.seller).league).closed) return;
    const sellers = view.rosterFor(g, l.seller),
      buyers = view.rosterFor(g, l.rival.club);
    const target = sellers.find((p) => p.id === l.player.id),
      offered = buyers.find((p) => p.id === l.rival.player.id);
    if (
      !target ||
      !offered ||
      target.injury ||
      offered.injury ||
      target.internationalDuty ||
      offered.internationalDuty ||
      balance(g, l.rival.club) < l.rival.cash ||
      target.pos !== offered.pos
    )
      return;
    if ([sellers, buyers].some((r) => r.length < 22 || r.length > 85)) return;
    if (
      assessTradeReturn(sellers, [offered], [target], l.rival.cash).status !== 'accepted' ||
      playerClubStanding(offered, buyers).tier === 'franchise'
    )
      return;
    return { sellers, target, offered };
  }
  function requireOpen(g: GameState, id: unknown) {
    const l = find(g, id);
    if (!l || l.status !== 'open' || gameDate(g) >= l.closes)
      throw new Error('이 선수의 매각 결정이 끝났습니다. 현재 트레이드 시장을 확인해 주세요.');
    if (!valid(g, l))
      throw new Error(
        '선수 소속·상태 또는 경쟁 조건이 달라졌습니다. 날짜를 진행해 시장 보고를 확인해 주세요.',
      );
    return l;
  }
  function review(g: GameState, o: TradeOffer) {
    if (!o.deadline) return;
    const l = requireOpen(g, o.deadline.id),
      bid = valid(g, l)!;
    const own = (o.counterOutgoing || o.outgoing)
      .map((id) => g.roster.find((p) => p.id === id))
      .filter((p): p is Player => !!p);
    const value = tradePackageValue(
      bid.sellers,
      own,
      [bid.target],
      o.status === 'counter' ? (o.counterCash ?? o.cash) : o.cash,
    ).total;
    const other = tradePackageValue(bid.sellers, [bid.offered], [bid.target], l.rival.cash).total;
    o.deadline.leading = ['accepted', 'counter'].includes(o.status) && value >= other;
    o.deadline.reviewed = gameDate(g);
    o.deadline.feedback = o.deadline.leading
      ? `경쟁 구단 이상의 조건으로 우선 협상할 수 있습니다. ${l.closes}로 날짜를 넘기기 전에 최종 확정하세요.`
      : `${view.getClub(l.rival.club).name}의 제안이 앞서 있습니다. 선수 구성이나 현금을 조정해 다시 제안할 수 있습니다.`;
  }
  function settle(g: GameState) {
    const market = g.deadlineMarket;
    if (!market) return;
    for (const l of market.listings) {
      if (l.status !== 'open') continue;
      if (
        market.club !== g.club ||
        market.year !== g.year ||
        g.managerCareer?.status !== 'employed'
      ) {
        l.status = 'cancelled';
        l.result = '구단 지휘를 마쳐 이 영입 경쟁을 정리했습니다.';
        for (const o of (g.trades || []).filter((o) => o.deadline?.id === l.id && active(o))) {
          o.status = 'expired';
          o.message = l.result;
        }
        continue;
      }
      const bid = valid(g, l);
      if (gameDate(g) < l.closes && bid) continue;
      if (!bid) {
        l.status = 'cancelled';
        l.result = '선수 소속·상태 또는 구단의 조건이 달라져 매각을 취소했습니다.';
      } else {
        for (const [player, destination] of [
          [bid.target, l.rival.club],
          [bid.offered, l.seller],
        ] as const) {
          archivePlayer(g, player, 'transfer', [], destination);
          player.club = destination;
          const transferred = g.transferred.find((p) => p.id === player.id);
          if (transferred) Object.assign(transferred, player);
          saveWorldPlayer(g, player, !catalogIds.has(player.id));
        }
        for (const [club, amount] of [
          [l.seller, l.rival.cash],
          [l.rival.club, -l.rival.cash],
        ] as const) {
          const account = (g.simulation!.clubs[club] ??= {
            balance: teamBudget(view.getClub(club).league),
            strategy: 'contend',
          });
          account.balance += amount;
        }
        g.simulation!.revision++;
        l.status = 'lost';
        l.result = `${l.player.name} 선수가 ${view.getClub(l.rival.club).name}으로 이적했습니다. ${l.rival.player.name} 선수는 ${view.getClub(l.seller).name}으로 이동했습니다.`;
        worldEvent(g, {
          kind: 'transfer',
          club: l.rival.club,
          otherClub: l.seller,
          playerId: l.player.id,
          text: l.result,
        });
      }
      for (const o of (g.trades || []).filter((o) => o.deadline?.id === l.id && active(o))) {
        o.status = 'expired';
        o.message = l.result!;
      }
      postNews(
        g,
        `${l.player.name} · ${l.status === 'lost' ? '경쟁 구단 이적' : '매각 취소'}`,
        l.result!,
        'transfer',
        { id: `deadline-result:${l.id}`, actionView: 'trade' },
      );
    }
  }
  function won(g: GameState, o: TradeOffer) {
    if (!o.deadline) return;
    const l = find(g, o.deadline.id);
    if (l) {
      l.status = 'won';
      l.result = `${l.player.name} 선수를 영입했습니다. 경쟁 구단의 제안은 종료됐습니다.`;
    }
  }
  return { prepare, settle, requireOpen, review, won };
}
