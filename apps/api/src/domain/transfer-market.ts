import { tradeWindow } from '@dugout/shared/trade-window';
import { playerClubStanding } from '@dugout/shared/trade-policy';
import { playerPersonality } from '@dugout/shared/personality';
import type { GameState, Player, WorldCatalog, SellerDecision } from '@dugout/shared/types';
import {
  createGameView,
  overall,
  askPrice,
  hash,
  teamBudget,
  money,
} from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';
export function createTransferMarket(world: WorldCatalog) {
  const view = createGameView(world);
  function closed(g: GameState, club: string) {
    return tradeWindow(g, view.getClub(club).league).closed;
  }
  function assess(g: GameState, p: Player): SellerDecision {
    if (g.deadlineMarket?.listings.some((l) => l.status === 'open' && l.player.id === p.id))
      return {
        club: p.club,
        status: 'refused',
        role: '마감 경쟁 매물',
        fee: 0,
        reason:
          '경쟁 구단의 선수 교환 제안이 들어온 매물입니다. 트레이드 센터에서 선수와 현금 조건을 함께 제안해 주세요.',
      };
    if (p.club === 'fa')
      return {
        club: 'fa',
        status: 'accepted',
        role: 'FA',
        fee: 0,
        reason: '자유계약 선수 · 구단 동의 불필요',
      };
    const roster = view.rosterFor(g, p.club),
      ordered = [...roster].sort((a, b) => overall(b) - overall(a)),
      peers = roster
        .filter((v) => v.id !== p.id && v.pos === p.pos)
        .sort((a, b) => overall(b) - overall(a));
    const core = ordered.slice(0, 3).some((v) => v.id === p.id),
      starter =
        p.pos === 'P'
          ? roster
              .filter((v) => v.pos === 'P')
              .sort((a, b) => overall(b) - overall(a))
              .slice(0, 5)
              .some((v) => v.id === p.id)
          : viewLineup(roster).includes(p.id);
    const role = core ? '핵심 선수' : starter ? '주전' : '로테이션 · 후보',
      thin = !peers.length || overall(p) - overall(peers[0]) > 7;
    const row = g.standings[view.getClub(p.club).league]?.find((s) => s.club === p.club),
      contending =
        !!row &&
        row.w + row.l + row.d >= 10 &&
        view.standings(g, view.getClub(p.club).league).findIndex((s) => s.club === p.club) < 4;
    let reason = '',
      status: SellerDecision['status'] = 'accepted';
    if (closed(g, g.club) || closed(g, p.club)) {
      status = 'refused';
      reason = '트레이드 마감 이후입니다.';
    } else if (
      (core && (g.phase === 'regular' || p.years >= 3)) ||
      (starter && thin) ||
      (g.phase === 'regular' && starter && contending && p.years >= 2)
    ) {
      status = 'refused';
      reason = core
        ? `${role}이며 ${p.years}년 계약이 남아 구단이 이적을 거절했습니다.`
        : thin
          ? '같은 포지션의 대체 전력이 부족해 구단이 거절했습니다.'
          : '순위 경쟁 중인 주전이라 이번 시즌에는 보내지 않겠다고 합니다.';
    }
    const standing = playerClubStanding(p, roster);
    if (['franchise', 'core', 'prospect'].includes(standing.tier)) {
      status = 'refused';
      reason = `${p.name} 선수는 ${standing.label}입니다. 현금 트레이드로 내보내지 않겠습니다. 선수 교환 조건으로 검토해 주세요.`;
    }
    const multiplier = core ? 2.7 : starter ? (g.phase === 'regular' ? 2.2 : 1.7) : 1;
    const fee = Math.round(askPrice(p) * multiplier);
    if (!reason) {
      status = multiplier > 1 ? 'counter' : 'accepted';
      reason = starter
        ? `대체 전력 확보 비용을 포함해 ${money(fee)}을 요구합니다.`
        : '선수단 내 역할과 잔여 계약을 검토한 뒤 이적에 동의했습니다.';
    }
    return { club: p.club, status, role, fee, reason };
  }
  function viewLineup(roster: Player[]) {
    return [...roster]
      .filter((p) => p.pos !== 'P')
      .sort((a, b) => overall(b) - overall(a))
      .slice(0, 9)
      .map((p) => p.id);
  }
  function list(g: GameState, id: string, value: boolean) {
    const p = g.roster.find((p) => p.id === id);
    if (!p) throw new Error('소속 선수를 선택해 주세요.');
    g.transferListed ??= {};
    if (value) {
      if (g.transferListed[id] !== undefined) return g;
      g.transferListed[id] = g.day;
      postNews(
        g,
        `${p.name} · 트레이드 대상 지정`,
        '관심 구단에 영입 의사를 문의했습니다. 현금 트레이드 제안이 도착하면 구단과 조건을 확인한 뒤 확정할 수 있습니다.',
        'transfer',
        { playerId: id },
      );
      if (p.mood) {
        const t = playerPersonality(p),
          loyal = t.loyalty >= 80 && t.homeClub === g.club;
        p.mood.value = Math.max(
          0,
          p.mood.value - (loyal ? 12 + Math.round(t.stubbornness / 20) : 5),
        );
        p.mood.reason = loyal
          ? '이 구단에 오래 남고 싶었는데 트레이드 대상으로 지정되어 실망함'
          : '트레이드 대상 지정으로 미래가 불확실함';
      }
    } else {
      delete g.transferListed[id];
      g.saleOffers = (g.saleOffers || []).filter((o) => o.playerId !== id);
    }
    return g;
  }
  function offerTick(g: GameState) {
    g.saleOffers = (g.saleOffers || []).filter(
      (o) => o.year === g.year && o.expires >= g.day && g.roster.some((p) => p.id === o.playerId),
    );
    if (closed(g, g.club)) return;
    for (const [id, listed] of Object.entries(g.transferListed || {})) {
      const p = g.roster.find((p) => p.id === id);
      if (
        !p ||
        g.day - listed < 2 ||
        (g.day - listed - 2) % 7 !== 0 ||
        g.saleOffers.some((o) => o.playerId === id)
      )
        continue;
      const candidates = world.clubs
        .filter(
          (c) =>
            c.id !== g.club &&
            c.league === view.getClub(g.club).league &&
            !closed(g, c.id) &&
            view.rosterFor(g, c.id).length < 85,
        )
        .map((c) => {
          const peers = view.rosterFor(g, c.id).filter((v) => v.pos === p.pos),
            level = peers.reduce((s, v) => s + overall(v), 0) / Math.max(1, peers.length),
            improvement = Math.max(overall(p), p.potential - 4) - level;
          return { c, improvement };
        })
        .filter(
          (x) =>
            x.improvement >= -2 &&
            p.salary < teamBudget(x.c.league) * 0.15 &&
            askPrice(p) * 0.7 < teamBudget(x.c.league) * 0.3 &&
            askPrice(p) * 0.9 <= (g.simulation?.clubs[x.c.id]?.balance ?? teamBudget(x.c.league)),
        )
        .sort((a, b) => b.improvement - a.improvement || hash(a.c.id + p.id) - hash(b.c.id + p.id));
      const buyer = candidates[0]?.c;
      if (!buyer) {
        postNews(
          g,
          `${p.name} · 관심 구단 없음`,
          '현재 연봉과 구단별 전력 구성을 검토했지만 영입 제안이 없습니다. 다음 주 다시 문의합니다.',
          'transfer',
          { playerId: id },
        );
        continue;
      }
      const fee = Math.round(askPrice(p) * (0.7 + (hash(p.id + buyer.id + g.year) % 21) / 100));
      const offer = {
        id: `sale-${g.year}-${g.day}-${p.id}-${buyer.id}`,
        playerId: p.id,
        club: buyer.id,
        fee,
        day: g.day,
        expires: g.day + 7,
        year: g.year,
      };
      g.saleOffers.push(offer);
      postNews(
        g,
        `${buyer.name}, ${p.name} 현금 트레이드 제안`,
        `${money(fee)} · ${dateLabelSimple(g, offer.expires)}까지 유효. 선수 상세의 계약 · 트레이드에서 확정하세요. 기존 연봉과 잔여 계약은 상대 구단이 승계합니다.`,
        'transfer',
        { playerId: p.id },
      );
    }
  }
  return { assess, closed, list, offerTick };
}
function dateLabelSimple(g: GameState, day: number) {
  return gameDate(g, day).slice(5).replace('-', '/');
}
