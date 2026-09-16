import type { GameState, NewsItem } from '@dugout/shared/types';
import { clubResults } from '@dugout/shared/club-results';
import { importantCareerReport } from '@dugout/shared/career-pace';
import { isClosedClubReport } from '@dugout/shared/employment-reports';
import { newsNeedsAction } from './inbox-model';

export function vacationSummaryModel(g: GameState, news: NewsItem) {
  const window = news.vacationSummary;
  if (!window) return null;
  const currentClub = window.club === g.club && g.managerCareer?.status !== 'unemployed';
  const inWindow = (date: string | undefined) =>
    !!date && date >= window.from && date <= window.through;
  const reports = g.news.filter(
    (n) =>
      n.id !== news.id &&
      !n.vacationSummary &&
      !isClosedClubReport(g, n) &&
      (!n.date || n.date <= window.through),
  );
  const subjects = new Set<string>();
  const decisions = currentClub
    ? reports.filter((n) => {
        if (!newsNeedsAction(n, g)) return false;
        const subject = n.dealId ? `deal:${n.dealId}` : n.id;
        if (subjects.has(subject)) return false;
        subjects.add(subject);
        return true;
      })
    : [];
  const decisionIds = new Set(decisions.map((n) => n.id));
  const during = reports.filter((n) => inWindow(n.date) && !decisionIds.has(n.id));
  const attention = currentClub ? during.filter((n) => !n.read && importantCareerReport(g, n)) : [];
  const attentionIds = new Set(attention.map((n) => n.id));
  const routine = during.filter((n) => !attentionIds.has(n.id));
  const results = clubResults({ ...g, club: window.club }).filter((r) => inWindow(r.date));
  const wins = results.filter((r) =>
    r.home === window.club ? r.homeScore > r.awayScore : r.awayScore > r.homeScore,
  ).length;
  const draws = results.filter((r) => r.homeScore === r.awayScore).length;
  return {
    decisions,
    attention,
    routine,
    results,
    wins,
    draws,
    losses: results.length - wins - draws,
    currentClub,
  };
}
