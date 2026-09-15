import { recordBoardTransaction } from './board-transactions';
import { assessTradeReturn, playerClubStanding } from '@dugout/shared/trade-policy';
import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import { createGameView, overall, money, teamBudget } from '@dugout/shared/game-view';
import { transfersBlocked, selectFirstTeam } from '@dugout/shared/management';
import { gameDate, addDays } from '@dugout/shared/calendar';
import { createTransferMarket } from './transfer-market';
import { archivePlayer, saveWorldPlayer, prepareWorld, worldEvent } from './world-simulation';
import { preparePitching } from '@dugout/shared/pitching';
import { repairMedicalSelection } from './medical';
import { postNews, prepareDynamics } from './club-dynamics';
import { prepareDevelopment } from './player-development';
import { createDeadlineMarket } from './deadline-market';
import { tradeCanRevise } from '@dugout/shared/trade-status';
import { tradeWindow } from '@dugout/shared/trade-window';
export function createTrades(world: WorldCatalog) {
  const view = createGameView(world),
    market = createTransferMarket(world),
    deadline = createDeadlineMarket(world);
  const catalogIds = new Set(world.players.map((p) => p.id));
  function validate(g: GameState, o: Pick<TradeOffer, 'club' | 'outgoing' | 'incoming' | 'cash'>) {
    if (transfersBlocked(g)) throw new Error('첫 시즌 외부 영입 금지 조건입니다.');
    if (
      !world.clubs.some((c) => c.id === o.club) ||
      o.club === g.club ||
      view.getClub(o.club).league !== view.getClub(g.club).league
    )
      throw new Error('같은 리그의 다른 구단과 트레이드할 수 있습니다.');
    if (market.closed(g, g.club) || market.closed(g, o.club))
      throw new Error('트레이드 마감 이후입니다.');
    for (const ids of [o.outgoing, o.incoming])
      if (
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > 3 ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== 'string')
      )
        throw new Error('양쪽 구단에서 각각 1~3명의 서로 다른 선수를 선택해 주세요.');
    if (!Number.isFinite(o.cash) || Math.abs(o.cash) > 1e8)
      throw new Error('현금 조건을 확인해 주세요.');
    const own = o.outgoing.map((id) => g.roster.find((p) => p.id === id)),
      otherRoster = view.rosterFor(g, o.club),
      other = o.incoming.map((id) => otherRoster.find((p) => p.id === id));
    if (own.some((p) => !p) || other.some((p) => !p))
      throw new Error('선수 소속이 변경되었습니다. 새 제안이 필요합니다.');
    if (
      g.budget < o.cash ||
      (g.simulation?.clubs[o.club]?.balance ?? teamBudget(view.getClub(o.club).league)) < -o.cash
    )
      throw new Error('현금 지급 예산이 부족합니다.');
    for (const [before, out, incoming] of [
      [g.roster, own, other],
      [otherRoster, other, own],
    ] as const) {
      const after = [
        ...before.filter((p) => !out.some((v) => v!.id === p.id)),
        ...(incoming as Player[]),
      ];
      if (after.length > 85 || after.length < 22)
        throw new Error('트레이드 후 선수단 정원(22~85명)을 지킬 수 없습니다.');
      for (const pos of ['P', 'C', 'IF', 'OF', 'DH'] as const)
        if (
          after.filter((p) => p.pos === pos).length <
          Math.min(
            before.filter((p) => p.pos === pos).length,
            { P: 7, C: 2, IF: 6, OF: 4, DH: 1 }[pos],
          )
        )
          throw new Error('트레이드 후 한 구단의 포지션 선수가 부족합니다.');
    }
    return { own: own as Player[], other: other as Player[] };
  }
  function notice(g: GameState, o: TradeOffer) {
    postNews(
      g,
      o.status === 'completed'
        ? `${view.getClub(g.club).name}·${view.getClub(o.club).name}, 트레이드 성사`
        : `${view.getClub(o.club).name} · 트레이드`,
      [o.message, activeDeadlineFeedback(o)].filter(Boolean).join('\n'),
      'transfer',
      {
        actionView: 'trade',
        tradeId: o.id,
        id: `trade:${o.id}:${o.status}:${gameDate(g)}:${o.round ?? o.deadline?.round ?? 1}`,
      },
    );
  }
  function playerCounter(g: GameState, o: TradeOffer, other: Player[]) {
    const theirRoster = view.rosterFor(g, o.club);
    if (other.some((p) => playerClubStanding(p, theirRoster).tier === 'franchise')) return null;
    const reserved = new Set(
      (g.trades || [])
        .filter((t) => t.id !== o.id && ['pending', 'accepted', 'counter'].includes(t.status))
        .flatMap((t) => [...t.outgoing, ...t.incoming, ...(t.counterOutgoing || [])]),
    );
    const available = g.roster
      .filter((p) => !reserved.has(p.id) && playerClubStanding(p, g.roster).tier !== 'franchise')
      .sort((a, b) => overall(a) - overall(b) || a.id.localeCompare(b.id));
    const comparable = available
      .filter((p) => overall(p) >= Math.max(...other.map(overall)) - 5)
      .slice(0, 12);
    const young = available
      .filter((p) => p.age <= 24)
      .sort((a, b) => b.potential - a.potential || overall(b) - overall(a))
      .slice(0, 8);
    const sets = comparable.map((p) => [p]);
    for (let i = 0; i < young.length; i++)
      for (let j = i + 1; j < young.length; j++) sets.push([young[i], young[j]]);
    for (const players of sets) {
      const result = assessTradeReturn(theirRoster, players, other, 0);
      if (result.status === 'rejected') continue;
      const cash = result.status === 'counter' ? result.cash : 0;
      try {
        validate(g, { ...o, outgoing: players.map((p) => p.id), cash });
      } catch {
        continue;
      }
      return {
        outgoing: players.map((p) => p.id),
        incoming: o.incoming,
        cash,
        message: `${other.map((p) => p.name).join(', ')} 선수를 보내는 대신 ${players.map((p) => p.name).join('·')} 선수를 원합니다. ${cash ? `추가 현금 ${cash > 0 ? '지급' : '수령'} ${money(Math.abs(cash))}을 포함한 조건입니다.` : '현금 없이 선수를 교환하는 조건입니다.'} 선수 구성을 확인한 뒤 수락해 주세요.`,
      };
    }
    return null;
  }
  function tick(g: GameState) {
    deadline.settle(g);
    deadline.prepare(g);
    for (const o of g.trades || []) {
      if (!['pending', 'accepted', 'counter'].includes(o.status)) continue;
      if (gameDate(g) > o.expires) {
        o.status = 'expired';
        o.message = '제안 기한이 지났습니다.';
        notice(g, o);
        continue;
      }
      if (o.status !== 'pending') {
        if (o.deadline) {
          const leading = o.deadline.leading;
          deadline.review(g, o);
          if (leading !== o.deadline.leading) notice(g, o);
        }
        continue;
      }
      if (gameDate(g) < o.due) continue;
      try {
        const { own, other } = validate(g, o);
        const assessment = assessTradeReturn(view.rosterFor(g, o.club), own, other, o.cash);
        const counter = assessment.status === 'rejected' ? playerCounter(g, o, other) : null;
        if (counter) {
          o.status = 'counter';
          o.counterOutgoing = counter.outgoing;
          o.counterIncoming = counter.incoming;
          o.counterCash = counter.cash;
          o.message = counter.message;
          deadline.review(g, o);
          notice(g, o);
          continue;
        }
        o.status = assessment.status;
        o.message = assessment.reason;
        if (assessment.status === 'counter') {
          o.counterCash = assessment.cash;
          o.message += ` 현금 ${assessment.cash >= 0 ? '지급' : '수령'} ${money(Math.abs(assessment.cash))} 조건입니다.`;
        }
        deadline.review(g, o);
      } catch (e) {
        o.status = 'rejected';
        o.message = (e as Error).message;
      }
      notice(g, o);
    }
  }
  function action(g: GameState, a: Record<string, unknown>) {
    if (
      ![
        'proposeTrade',
        'reviseTrade',
        'reviseDeadlineTrade',
        'acceptTrade',
        'withdrawTrade',
      ].includes(String(a.type))
    )
      return null;
    if (g.liveMatch) throw new Error('경기 종료 후 트레이드를 진행해 주세요.');
    prepareWorld(g);
    g.trades ??= [];
    if (a.type === 'proposeTrade') {
      if (g.trades.filter((o) => ['pending', 'accepted', 'counter'].includes(o.status)).length >= 3)
        throw new Error('동시에 세 건까지 제안할 수 있습니다.');
      const today = gameDate(g),
        o: TradeOffer = {
          id: `trade-${g.year}-${g.simulation!.serial++}`,
          round: 1,
          club: String(a.club),
          outgoing: a.outgoing as string[],
          incoming: a.incoming as string[],
          cash: Number(a.cash),
          date: today,
          due: addDays(today, 2),
          expires: addDays(today, 10),
          status: 'pending',
          message: '구단이 선수 구성과 현금 조건을 검토합니다. 2일 뒤 답변 예정.',
        };
      validate(g, o);
      const window = tradeWindow(g, view.getClub(g.club).league);
      if (g.phase === 'regular' && window.date) {
        o.due = [o.due, window.date].sort()[0];
        o.expires = [o.expires, window.date].sort()[0];
      }
      const listed =
        g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year
          ? g.deadlineMarket.listings.find(
              (l) => l.status === 'open' && o.incoming.includes(l.player.id),
            )
          : undefined;
      const deadlineId = a.deadlineId ?? listed?.id;
      if (deadlineId !== undefined) {
        const listing = deadline.requireOpen(g, deadlineId);
        if (
          listing.seller !== o.club ||
          o.incoming.length !== 1 ||
          o.incoming[0] !== listing.player.id
        )
          throw new Error('매물의 구단과 대상 선수를 확인해 주세요.');
        o.deadline = { id: listing.id, leading: false, reviewed: today, round: 1 };
        o.due = today;
        o.expires = addDays(listing.closes, -1);
        o.message = '매각 결정 전에 경쟁 조건과 함께 즉시 검토합니다.';
      } else if (o.due === today) o.message = '마감일 제안입니다. 구단이 지금 조건을 검토합니다.';
      const ids = [...o.outgoing, ...o.incoming];
      if (
        g.trades.some(
          (t) =>
            ['pending', 'accepted', 'counter'].includes(t.status) &&
            [
              ...t.outgoing,
              ...t.incoming,
              ...(t.counterOutgoing || []),
              ...(t.counterIncoming || []),
            ].some((id) => ids.includes(id)),
        )
      )
        throw new Error('다른 트레이드에 포함된 선수입니다. 먼저 기존 제안을 철회해 주세요.');
      g.trades = [o, ...g.trades].slice(0, 30);
      if (o.due === today) tick(g);
      else notice(g, o);
      return g;
    }
    const offer = g.trades.find((o) => o.id === a.id);
    if (
      !offer ||
      ![
        'pending',
        'accepted',
        'counter',
        ...(['reviseTrade', 'reviseDeadlineTrade'].includes(String(a.type)) ? ['rejected'] : []),
      ].includes(offer.status)
    )
      throw new Error('진행 중인 트레이드 제안이 없습니다.');
    if (a.type === 'withdrawTrade') {
      offer.status = 'withdrawn';
      offer.message = '감독이 제안을 철회했습니다.';
      notice(g, offer);
      return g;
    }
    if (a.type === 'reviseTrade' || a.type === 'reviseDeadlineTrade') {
      if (!tradeCanRevise(g, offer)) throw new Error('협상 기한이 지났거나 종료된 제안입니다.');
      if (a.type === 'reviseDeadlineTrade' && !offer.deadline)
        throw new Error('마감 경쟁 중인 제안만 이곳에서 수정할 수 있습니다.');
      if (offer.deadline) deadline.requireOpen(g, offer.deadline.id);
      if (
        offer.status === 'rejected' &&
        g.trades.filter((o) => ['pending', 'accepted', 'counter'].includes(o.status)).length >= 3
      )
        throw new Error('동시에 세 건까지 제안할 수 있습니다.');
      const revised = {
        ...offer,
        outgoing: a.outgoing as string[],
        incoming: a.incoming === undefined ? offer.incoming : (a.incoming as string[]),
        cash: Number(a.cash),
      };
      validate(g, revised);
      const listed =
        g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year
          ? g.deadlineMarket.listings.find(
              (l) => l.status === 'open' && revised.incoming.includes(l.player.id),
            )
          : undefined;
      if (offer.deadline || listed) {
        const listing = deadline.requireOpen(g, offer.deadline?.id ?? listed!.id);
        if (
          revised.club !== listing.seller ||
          revised.incoming.length !== 1 ||
          revised.incoming[0] !== listing.player.id
        )
          throw new Error('마감 경쟁에서는 대상 선수를 바꿀 수 없습니다.');
        revised.deadline ??= {
          id: listing.id,
          leading: false,
          reviewed: gameDate(g),
          round: offer.round ?? 1,
        };
        revised.expires = [offer.expires, addDays(listing.closes, -1)].sort()[0];
      }
      const ids = [...revised.outgoing, ...revised.incoming];
      if (
        g.trades.some(
          (o) =>
            o.id !== offer.id &&
            ['pending', 'accepted', 'counter'].includes(o.status) &&
            [
              ...o.outgoing,
              ...o.incoming,
              ...(o.counterOutgoing || []),
              ...(o.counterIncoming || []),
            ].some((id) => ids.includes(id)),
        )
      )
        throw new Error('다른 협상에 포함된 선수입니다.');
      offer.history = [
        ...(offer.history || []),
        {
          round: offer.round ?? offer.deadline?.round ?? 1,
          date: gameDate(g),
          outgoing: [...offer.outgoing],
          incoming: [...offer.incoming],
          cash: offer.cash,
          status: offer.status,
          message: offer.message.slice(0, 240),
          counterOutgoing: offer.counterOutgoing && [...offer.counterOutgoing],
          counterIncoming: offer.counterIncoming && [...offer.counterIncoming],
          counterCash: offer.counterCash,
        },
      ].slice(-6);
      offer.round = (offer.round ?? offer.deadline?.round ?? 1) + 1;
      offer.outgoing = revised.outgoing;
      offer.incoming = revised.incoming;
      offer.cash = revised.cash;
      offer.deadline = revised.deadline;
      offer.expires = revised.expires;
      if (offer.deadline) offer.deadline.round = offer.round;
      offer.status = 'pending';
      offer.due = gameDate(g);
      delete offer.counterCash;
      delete offer.counterOutgoing;
      delete offer.counterIncoming;
      tick(g);
      return g;
    }
    if (!['accepted', 'counter'].includes(offer.status) || gameDate(g) > offer.expires)
      throw new Error('유효한 구단 답변이 필요합니다.');
    const cash = offer.status === 'counter' ? offer.counterCash! : offer.cash,
      { own, other } = validate(g, {
        ...offer,
        outgoing: offer.counterOutgoing || offer.outgoing,
        incoming: offer.counterIncoming || offer.incoming,
        cash,
      });
    const assessment = assessTradeReturn(view.rosterFor(g, offer.club), own, other, cash);
    if (assessment.status !== 'accepted')
      throw new Error(
        assessment.status === 'rejected'
          ? assessment.reason
          : '선수 가치가 달라졌습니다. 새 조건으로 제안해 주세요.',
      );
    if (offer.deadline) {
      deadline.review(g, offer);
      if (!offer.deadline.leading)
        throw new Error(
          '경쟁 구단의 조건이 앞서 있습니다. 선수나 현금 조건을 조정해 다시 제안해 주세요.',
        );
    }
    recordBoardTransaction(g, offer.id, other, own, view.rosterFor(g, offer.club));
    const outgoing = new Set(own.map((p) => p.id)),
      incoming = new Set(other.map((p) => p.id));
    for (const p of own) {
      archivePlayer(g, p, 'transfer', [], offer.club);
      p.club = offer.club;
      saveWorldPlayer(g, p, !catalogIds.has(p.id));
    }
    for (const p of other) {
      archivePlayer(g, p, 'transfer', [], g.club);
      p.club = g.club;
      p.squad = 'reserve';
      saveWorldPlayer(g, p, !catalogIds.has(p.id));
    }
    g.roster = [...g.roster.filter((p) => !outgoing.has(p.id)), ...other];
    g.transferred = [
      ...g.transferred.filter((p) => !outgoing.has(p.id) && !incoming.has(p.id)),
      ...own,
    ];
    g.simulation!.revision++;
    g.budget -= cash;
    if (cash >= 0) g.expenses += cash;
    else g.income -= cash;
    const otherClub = (g.simulation!.clubs[offer.club] ??= {
      balance: teamBudget(view.getClub(offer.club).league),
      strategy: 'contend',
    });
    otherClub.balance += cash;
    selectFirstTeam(g);
    prepareDevelopment(g);
    prepareDynamics(g);
    preparePitching(g);
    repairMedicalSelection(g);
    for (const id of idsOf(offer)) {
      delete g.transferListed?.[id];
    }
    g.saleOffers = (g.saleOffers || []).filter((o) => !outgoing.has(o.playerId));
    g.deals = g.deals.filter((d) => !outgoing.has(d.player.id) && !incoming.has(d.player.id));
    offer.outgoing = own.map((p) => p.id);
    offer.incoming = other.map((p) => p.id);
    delete offer.counterOutgoing;
    delete offer.counterIncoming;
    offer.status = 'completed';
    deadline.won(g, offer);
    offer.cash = cash;
    offer.message = `${view.getClub(g.club).name}과 ${view.getClub(offer.club).name}이 트레이드를 완료했습니다.\n${view.getClub(offer.club).name} 합류: ${own.map((p) => p.name).join(', ')}\n${view.getClub(g.club).name} 합류: ${other.map((p) => p.name).join(', ')}\n${cash === 0 ? '현금 없이 선수를 교환했습니다.' : `${view.getClub(cash > 0 ? g.club : offer.club).name}이 ${money(Math.abs(cash))}을 추가 지급했습니다.`} 기존 계약과 시즌 기록은 새 구단으로 이어집니다.`;
    worldEvent(g, { kind: 'transfer', club: g.club, otherClub: offer.club, text: offer.message });
    notice(g, offer);
    return g;
  }
  return { action, tick, validate, prepare: deadline.prepare };
}
const idsOf = (o: TradeOffer) => [...o.outgoing, ...o.incoming];
const activeDeadlineFeedback = (o: TradeOffer) =>
  ['pending', 'accepted', 'counter', 'rejected'].includes(o.status)
    ? o.deadline?.feedback
    : undefined;
