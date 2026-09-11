import type { GameState, NewsItem } from '@dugout/shared/types';
import { scoutingGuide } from '@dugout/shared/scouting-guide';
import { tradeNeedsConfirmation, tradeStatus, isActiveTrade } from '@dugout/shared/trade-status';

export function reportDestination(news: NewsItem, g?: GameState) {
  if (news.actionView === 'augmentations')
    return {
      href: '/?view=augmentations',
      label: '카드 · 증강 보관함 열기',
      detail: '카드로 상대 선수를 방해하고 증강으로 우리 팀을 강화합니다.',
      guide: false,
    };
  if (news.actionView === 'draft')
    return {
      href: '/?view=draft',
      label: '신인 드래프트 · 지명하러 가기',
      detail:
        '스카우트 → 신인 드래프트에서 후보를 보고 지명하거나 코치에게 남은 지명을 맡길 수 있습니다.',
      guide: false,
    };
  if (news.actionView === 'scouting') {
    const completed = !!news.report;
    return {
      href: `/?view=scouting&tab=${completed ? 'reports' : 'missions'}${completed && news.scoutAssignmentId ? `&mission=${encodeURIComponent(news.scoutAssignmentId)}` : ''}`,
      label: completed ? '관찰 보고서 보기' : '스카우트 관찰 현황 열기',
      detail: completed
        ? '스카우트 → 보고 · 비교에서 선수별 능력 범위와 강점·우려 사항을 확인하세요.'
        : '스카우트 → 관찰 임무에서 새 파견을 의뢰하고 보고 예정일을 확인하세요.',
      guide: news.title === scoutingGuide.title,
    };
  }
  if (news.actionView === 'trade') {
    const offer = g?.trades?.find((offer) => offer.id === news.tradeId);
    const ready = !!g && !!offer && tradeNeedsConfirmation(g, offer);
    const closed = !!g && !!offer && !isActiveTrade(g, offer);
    return {
      href: '/?view=trade',
      label: closed
        ? '트레이드 결과 확인'
        : ready || !offer
          ? '트레이드 협상 · 최종 확정'
          : '트레이드 진행 상황 보기',
      detail: closed
        ? tradeStatus(g!, offer!) === 'completed'
          ? '선수와 현금 교환이 완료됐습니다. 추가 확정은 필요하지 않습니다.'
          : '종료된 제안입니다. 트레이드 화면의 지난 협상에서 결과를 확인하세요.'
        : ready || !offer
          ? '협상 중인 트레이드에서 수락·역제안 조건을 확인하고 ‘위 조건으로 교환 확정’을 누르면 완료됩니다.'
          : '상대 구단이 제안을 검토하고 있습니다. 답변이 오면 조건을 확인하고 최종 확정하세요.',
      guide: false,
    };
  }
  return null;
}
