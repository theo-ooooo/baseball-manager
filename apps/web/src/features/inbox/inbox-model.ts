import { isClosedClubReport } from '@dugout/shared/employment-reports';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import {
  needsContractReview,
  contractReportStatus,
  managerReportNeedsAction,
} from '@dugout/shared/contract-status';
import { lineupRecommendationError } from '@dugout/shared/lineup-recommendation';
import type { GameState, NewsItem } from '@dugout/shared/types';
import { tradeNeedsConfirmation } from '@dugout/shared/trade-status';
export const newsKinds: Record<string, { label: string; sender: string; role: string }> = {
  challenge: { label: '도전', sender: '도전 기록', role: '목표와 결과' },
  league: { label: '세계 야구', sender: '야구 소식', role: '리그 동향' },
  manager: { label: '감독 · 채용', sender: '구단주 사무실', role: '감독 계약·채용' },
  contract: { label: '계약 관리', sender: '계약 담당자', role: '선수 계약 관리' },
  transfer: { label: '영입 · 협상', sender: '영입 담당자', role: '영입 및 에이전트 연락' },
  scout: { label: '스카우팅', sender: '전력 분석팀', role: '상대 전력 분석' },
  lineup: { label: '경기 준비', sender: '수석 코치', role: '추천 명단 · 타순 보고' },
  match: { label: '경기 보고', sender: '수석 코치', role: '경기 결과 브리핑' },
  training: { label: '훈련', sender: '코칭 스태프', role: '선수단 관리' },
  development: { label: '성장 보고', sender: '육성 담당 코치', role: '성장 및 기량 변화' },
  morale: { label: '선수 면담', sender: '선수 연락 담당', role: '선수단 소통' },
  media: { label: '인터뷰 · 팀 대화', sender: '구단 홍보 담당', role: '언론과 선수단 일정' },
  club: { label: '구단 소식', sender: '구단 사무국', role: '감독 업무 지원' },
};
export function newsMeta(news: NewsItem) {
  const kind = newsKinds[news.kind] || newsKinds.club;
  return { ...kind, ...news.sender };
}
export function contractReview(news: NewsItem) {
  return (
    news.report?.purpose === 'contractReview' ||
    (news.kind === 'contract' && news.title === '계약 만료 예정 선수 점검')
  );
}
export function newsNeedsAction(news: NewsItem, g: GameState) {
  if (contractReportStatus(g, news) || isClosedClubReport(g, news)) return false;
  if (news.tradeId) {
    const trade = g.trades?.find((offer) => offer.id === news.tradeId);
    const latest = g.news.find((item) => item.tradeId === news.tradeId);
    return latest?.id === news.id && !!trade && tradeNeedsConfirmation(g, trade);
  }
  if (isClubSeasonRest(g) && (news.choiceKind === 'playingTime' || news.kind === 'training'))
    return false;
  if (news.lineupRecommendation) return !lineupRecommendationError(g, news);
  if (news.managerOfferId) return managerReportNeedsAction(g, news);
  if (news.id === `media-pending:${g.media?.pending?.key}`) return true;
  if (
    g.coachRecommendations?.some(
      (r) => r.playerId === news.playerId && r.date === news.date && r.status === 'pending',
    )
  )
    return true;
  if (news.choiceKind && !news.choice) return true;
  if (contractReview(news))
    return (
      news.report?.players?.map((p) => p.id) ||
      g.roster.filter((p) => needsContractReview(g, p)).map((p) => p.id)
    ).some((id) => g.roster.some((p) => p.id === id && needsContractReview(g, p)));
  return [...g.deals, ...(g.coachDeals || [])].some(
    (d) =>
      (d.id === news.dealId || (!news.dealId && 'player' in d && d.player.id === news.playerId)) &&
      ['counter', 'accepted'].includes(d.status) &&
      (d.year === undefined || d.year === g.year) &&
      g.day <= (d.expires ?? d.day + 14),
  );
}
