import type { NewsItem } from '@dugout/shared/types';
import { scoutingGuide } from '@dugout/shared/scouting-guide';

export function reportDestination(news: NewsItem) {
  if (news.actionView === 'scouting') {
    const completed = !!news.report;
    return {
      href: `/?view=scouting&tab=${completed ? 'reports' : 'missions'}`,
      label: completed ? '관찰 보고서 보기' : '스카우트 관찰 현황 열기',
      detail: completed
        ? '스카우트 → 보고 · 비교에서 선수별 능력 범위와 강점·우려 사항을 확인하세요.'
        : '스카우트 → 관찰 임무에서 새 파견을 의뢰하고 보고 예정일을 확인하세요.',
      guide: news.title === scoutingGuide.title,
    };
  }
  if (news.actionView === 'trade')
    return {
      href: '/?view=trade',
      label: '트레이드 협상 · 최종 확정',
      detail:
        '협상 중인 트레이드에서 수락·역제안 조건을 확인하고 ‘위 조건으로 교환 확정’을 누르면 완료됩니다.',
      guide: false,
    };
  return null;
}
