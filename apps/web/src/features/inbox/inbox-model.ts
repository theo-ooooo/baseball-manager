import type { GameState, NewsItem } from '@dugout/shared/types';
export const newsKinds: Record<string, { label: string; sender: string; role: string }> = {
  league: { label: '세계 야구', sender: '야구 소식', role: '리그 동향' },
  manager: { label: '감독 · 채용', sender: '구단주 사무실', role: '감독 계약·채용' },
  contract: { label: '계약 관리', sender: '계약 담당자', role: '선수 계약 관리' },
  transfer: { label: '이적 · 협상', sender: '영입 담당자', role: '영입 및 에이전트 연락' },
  scout: { label: '스카우팅', sender: '전력 분석팀', role: '상대 전력 분석' },
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
  if (news.managerOfferId)
    return (
      g.managerCareer?.offers.some(
        (o) =>
          o.id === news.managerOfferId && ['invited', 'interview', 'offered'].includes(o.status),
      ) || false
    );
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
      g.roster.filter((p) => p.years === 1).map((p) => p.id)
    ).some((id) => g.roster.some((p) => p.id === id && p.years === 1));
  return [...g.deals, ...(g.coachDeals || [])].some(
    (d) =>
      (d.id === news.dealId || (!news.dealId && 'player' in d && d.player.id === news.playerId)) &&
      ['counter', 'accepted'].includes(d.status) &&
      (d.year === undefined || d.year === g.year) &&
      g.day <= (d.expires ?? d.day + 14),
  );
}
