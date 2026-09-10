import type { NewsItem } from './types';

export const scoutingGuide = {
  title: '선수 탐색 · 스카우트 이용 안내',
  body: '선수 시장에서 영입 후보를 찾거나 스카우트 화면의 ‘새 파견’으로 관찰을 의뢰하세요. 관찰이 끝나면 수신함에 결과가 도착하며, 스카우트 → 보고 · 비교에서 선수별 능력 범위와 강점·우려 사항을 확인할 수 있습니다.',
} as const;

// Older careers received this introductory letter before any observation was commissioned.
// Correct its presentation without changing its ID, read status, or saved scouting results.
export function presentScoutingNews(news: NewsItem): NewsItem {
  if (
    news.kind === 'scout' &&
    news.title === '스카우팅 리포트 도착' &&
    news.body ===
      '세계 선수 시장에서 실명 선수와 가상 유망주를 확인할 수 있습니다. 에이전트에게 계약 조건을 제안하세요.' &&
    !news.report
  )
    return { ...news, ...scoutingGuide, actionView: 'scouting' };
  return news;
}
