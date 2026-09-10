import type { GameState, Player, WorldCatalog } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import { createGameView, askPrice, money, teamBudget } from '@dugout/shared/game-view';
import { transfersBlocked, selectFirstTeam } from '@dugout/shared/management';
import { gameDate, addDays } from '@dugout/shared/calendar';
import { createTransferMarket } from './transfer-market';
import { archivePlayer, saveWorldPlayer, prepareWorld, worldEvent } from './world-simulation';
import { preparePitching } from '@dugout/shared/pitching';
import { repairMedicalSelection } from './medical';
import { postNews } from './club-dynamics';
export function createTrades(world: WorldCatalog) {
  const view = createGameView(world),
    market = createTransferMarket(world);
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
    postNews(g, `${view.getClub(o.club).name} · 트레이드`, o.message, 'transfer', {
      actionView: 'trade',
      tradeId: o.id,
      id: `trade:${o.id}:${o.status}:${gameDate(g)}`,
    });
  }
  function tick(g: GameState) {
    for (const o of g.trades || []) {
      if (!['pending', 'accepted', 'counter'].includes(o.status)) continue;
      if (gameDate(g) > o.expires) {
        o.status = 'expired';
        o.message = '제안 기한이 지났습니다.';
        notice(g, o);
        continue;
      }
      if (o.status !== 'pending' || gameDate(g) < o.due) continue;
      try {
        const { own, other } = validate(g, o);
        const incoming = other.reduce((s, p) => s + askPrice(p), 0) * 1.1,
          provided = own.reduce((s, p) => s + askPrice(p), 0);
        const cash = Math.ceil(incoming - provided);
        if (provided + o.cash >= incoming) {
          o.status = 'accepted';
          o.message =
            '전력과 재정 조건에 동의했습니다. 최종 확정하면 선수와 현금이 함께 이동합니다.';
        } else if (provided + Math.max(0, o.cash) < incoming * 0.3) {
          o.status = 'rejected';
          o.message = '상대 구단이 전력 가치 차이가 커 제안을 거절했습니다.';
        } else {
          o.status = 'counter';
          o.counterCash = cash;
          o.message = `선수 구성은 유지하고 현금 ${cash >= 0 ? '지급' : '수령'} ${money(Math.abs(cash))} 조건을 제시했습니다.`;
        }
      } catch (e) {
        o.status = 'rejected';
        o.message = (e as Error).message;
      }
      notice(g, o);
    }
  }
  function action(g: GameState, a: Record<string, unknown>) {
    if (!['proposeTrade', 'acceptTrade', 'withdrawTrade'].includes(String(a.type))) return null;
    if (g.liveMatch) throw new Error('경기 종료 후 트레이드를 진행해 주세요.');
    prepareWorld(g);
    g.trades ??= [];
    if (a.type === 'proposeTrade') {
      if (g.trades.filter((o) => ['pending', 'accepted', 'counter'].includes(o.status)).length >= 3)
        throw new Error('동시에 세 건까지 제안할 수 있습니다.');
      const today = gameDate(g),
        o: TradeOffer = {
          id: `trade-${g.year}-${g.simulation!.serial++}`,
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
      const ids = [...o.outgoing, ...o.incoming];
      if (
        g.trades.some(
          (t) =>
            ['pending', 'accepted', 'counter'].includes(t.status) &&
            [...t.outgoing, ...t.incoming].some((id) => ids.includes(id)),
        )
      )
        throw new Error('다른 트레이드에 포함된 선수입니다. 먼저 기존 제안을 철회해 주세요.');
      g.trades = [o, ...g.trades].slice(0, 30);
      notice(g, o);
      return g;
    }
    const offer = g.trades.find((o) => o.id === a.id);
    if (!offer || !['pending', 'accepted', 'counter'].includes(offer.status))
      throw new Error('진행 중인 트레이드 제안이 없습니다.');
    if (a.type === 'withdrawTrade') {
      offer.status = 'withdrawn';
      offer.message = '감독이 제안을 철회했습니다.';
      notice(g, offer);
      return g;
    }
    if (!['accepted', 'counter'].includes(offer.status) || gameDate(g) > offer.expires)
      throw new Error('유효한 구단 답변이 필요합니다.');
    const cash = offer.status === 'counter' ? offer.counterCash! : offer.cash,
      { own, other } = validate(g, { ...offer, cash });
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
    preparePitching(g);
    repairMedicalSelection(g);
    for (const id of idsOf(offer)) {
      delete g.transferListed?.[id];
    }
    g.saleOffers = (g.saleOffers || []).filter((o) => !outgoing.has(o.playerId));
    g.deals = g.deals.filter((d) => !outgoing.has(d.player.id) && !incoming.has(d.player.id));
    offer.status = 'completed';
    offer.cash = cash;
    offer.message = `${own.map((p) => p.name).join(', ')} ↔ ${other.map((p) => p.name).join(', ')} · 현금 ${cash >= 0 ? '지급' : '수령'} ${money(Math.abs(cash))}. 기존 계약과 시즌 기록을 승계했습니다.`;
    worldEvent(g, { kind: 'transfer', club: g.club, otherClub: offer.club, text: offer.message });
    notice(g, offer);
    return g;
  }
  return { action, tick, validate };
}
const idsOf = (o: TradeOffer) => [...o.outgoing, ...o.incoming];
