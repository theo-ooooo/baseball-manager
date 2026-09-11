import type { GameState, NewsItem, Player } from './types';
import { gameDate } from './calendar';

export function needsContractReview(g: Pick<GameState, 'year' | 'roster' | 'news'>, p: Player) {
  if (p.years !== 1 || p.contractSigned?.year === g.year) return false;
  // Older saves have signing reports, but no signing marker on the player yet.
  return !g.news.some(
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
