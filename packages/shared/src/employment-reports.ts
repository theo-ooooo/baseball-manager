import type { GameState, NewsItem } from './types';

export function isClubDutyReport(n: Pick<NewsItem, 'kind' | 'managerOfferId'>) {
  return (
    !n.managerOfferId &&
    [
      'contract',
      'transfer',
      'training',
      'development',
      'morale',
      'scout',
      'lineup',
      'match',
      'media',
      'club',
    ].includes(n.kind)
  );
}
export function isClosedClubReport(g: Pick<GameState, 'managerCareer'>, n: NewsItem) {
  return !!n.employmentClosed || (g.managerCareer?.status === 'unemployed' && isClubDutyReport(n));
}
