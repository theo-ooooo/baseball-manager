import type { Deal, GameState, NewsItem, Player } from './types';
import { gameDate } from './calendar';

export const MAX_PLAYER_NEGOTIATIONS = 128;
/** Remaining seasons include this season; a renewal guarantees the following full seasons. */
export function playerDealPeriod(year: number, type: Deal['type'], years: number) {
  const startYear = year + (type === 'renew' ? 1 : 0);
  const endYear = startYear + years - 1;
  return { startYear, endYear, remainingYears: endYear - year + 1 };
}
export function activePlayerDeal(g: Pick<GameState, 'year' | 'day'>, d: Deal) {
  return (
    ['pending', 'counter', 'accepted'].includes(d.status) &&
    (d.year === undefined || d.year === g.year) &&
    g.day <= (d.expires ?? d.day + 14)
  );
}

export function renewalUnavailableReason(g: GameState, p: Player) {
  if (
    g.managerCareer?.status === 'unemployed' ||
    p.club !== g.club ||
    !g.roster.some((x) => x.id === p.id)
  )
    return '소속 선수만 재계약할 수 있습니다.';
  if (!needsContractReview(g, p)) return '계약 만료 대상이 아니거나 이번 시즌 계약을 마쳤습니다.';
  if (g.deals.some((d) => d.player.id === p.id && activePlayerDeal(g, d)))
    return '진행 중인 협상에서 답변·서명을 마쳐 주세요.';
  return undefined;
}

export function needsContractReview(g: Pick<GameState, 'year' | 'roster' | 'news'>, p: Player) {
  return p.years === 1 && !contractSignedThisYear(g, p);
}
export function contractSignedThisYear(g: Pick<GameState, 'year' | 'news'>, p: Player) {
  if (p.contractSigned?.year === g.year) return true;
  // Older saves have signing reports, but no signing marker on the player yet.
  return g.news.some(
    (n) =>
      n.playerId === p.id &&
      n.year === g.year &&
      n.kind === 'transfer' &&
      /(?:재계약|영입) 완료$/.test(n.title),
  );
}

/** Resolve against today's actual deal; old reports must never restart a completed negotiation. */
export function contractReportStatus(g: GameState, n: NewsItem): 'signed' | 'closed' | undefined {
  if (n.contractResolution === 'signed') return 'signed';
  if (n.managerOfferId) {
    const offer = g.managerCareer?.offers.find((o) => o.id === n.managerOfferId);
    return !offer || ['expired', 'rejected'].includes(offer.status) || offer.expires < gameDate(g)
      ? 'closed'
      : undefined;
  }
  if (!n.dealId) return undefined;
  const deal = [...g.deals, ...(g.coachDeals || [])].find((d) => d.id === n.dealId);
  return !deal ||
    ['withdrawn', 'expired', 'rejected'].includes(deal.status) ||
    (deal.year !== undefined && deal.year !== g.year) ||
    g.day > (deal.expires ?? deal.day + 14)
    ? 'closed'
    : undefined;
}

/** A recruitment thread has one current decision; pending board replies require only time. */
export function managerReportNeedsAction(g: GameState, n: NewsItem) {
  if (!n.managerOfferId || contractReportStatus(g, n)) return false;
  const offer = g.managerCareer?.offers.find((o) => o.id === n.managerOfferId);
  const latest = g.news.find((item) => item.managerOfferId === n.managerOfferId);
  return (
    latest?.id === n.id &&
    !!offer &&
    ['invited', 'interview', 'offered'].includes(offer.status) &&
    offer.contractTerms?.status !== 'pending'
  );
}

/** A historical report or open dialog must use today's employer and negotiation scope. */
export function playerContractContext(
  g: import('./types').GameState,
  player: import('./types').Player | undefined,
) {
  const employed = g.managerCareer?.status !== 'unemployed';
  const own =
    !!player && employed && player.club === g.club && g.roster.some((p) => p.id === player.id);
  const allowed = !!player && employed && (own || player.club === 'fa');
  const deal = allowed
    ? g.deals.find(
        (d) =>
          d.player.id === player.id &&
          d.player.club === player.club &&
          (own ? d.type === 'renew' : d.type === 'buy'),
      )
    : undefined;
  return { own, allowed, found: !!player, deal };
}
