import type { GameState, NewsItem } from './types';
import { contractReportStatus, managerReportNeedsAction } from './contract-status';
import { isClosedClubReport } from './employment-reports';
import { tradeNeedsConfirmation } from './trade-status';

/** One shared priority policy for navigation and server date progression. Never marks mail read. */
export function importantCareerReport(g: GameState, n: NewsItem) {
  if (isClosedClubReport(g, n) || contractReportStatus(g, n)) return false;
  if (n.managerOfferId) return managerReportNeedsAction(g, n);
  if (n.choiceKind && !n.choice) return true;
  if (n.priority === 'urgent') return true;
  if (n.tradeId)
    return g.trades?.some((o) => o.id === n.tradeId && tradeNeedsConfirmation(g, o)) || false;
  if (
    n.playerId &&
    g.saleOffers?.some((o) => o.playerId === n.playerId && o.year === g.year && o.expires >= g.day)
  )
    return true;
  if (
    [...g.deals, ...(g.coachDeals || [])].some(
      (d) =>
        (d.id === n.dealId || (!n.dealId && 'player' in d && d.player.id === n.playerId)) &&
        ['counter', 'accepted'].includes(d.status) &&
        (d.year === undefined || d.year === g.year) &&
        (d.expires ?? d.day + 14) >= g.day,
    )
  )
    return true;
  if (n.actionView === 'medical') return true;
  if (n.actionView === 'draft' && g.draft?.status === 'open') return true;
  if (n.report?.purpose === 'contractReview' && g.phase === 'finished') return true;
  return false;
}
export function stopsForReport(g: GameState, n: NewsItem) {
  return g.engagement?.reportMode === 'all' || importantCareerReport(g, n);
}
