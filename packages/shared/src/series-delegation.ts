import type { GameState } from './types';
import { preseasonSkipBlockers, describePreseasonSkipBlockers } from './preseason';
import { importantCareerReport } from './career-pace';
import { matchInboxDecision } from './match-inbox';

/** Use the same pending decisions on the screen and when validating a saved command. */
export function seriesDelegationDecision(g: GameState) {
  const conversation = g.news.find((n) => n.choiceKind && !n.choice);
  if (conversation)
    return {
      reason: '선수와의 필수 면담에 답변해 주세요.',
      href: `/?view=inbox&report=${encodeURIComponent(conversation.id)}`,
      label: '필수 면담 답변하기',
    };
  const blocks = preseasonSkipBlockers(g);
  const first = blocks[0];
  if (first) {
    const destinations = {
      managerOffer: {
        href: `/interviews/${encodeURIComponent(first.id)}`,
        label: '감독 제안 확인',
      },
      deal: { href: '/?view=agents', label: '선수 계약 답변 확인' },
      coachDeal: { href: '/?view=staff', label: '코치 계약 답변 확인' },
      saleOffer: {
        href: `/players/${encodeURIComponent(g.saleOffers?.find((o) => o.id === first.id)?.playerId || '')}`,
        label: '현금 트레이드 제안 확인',
      },
      draft: { href: '/?view=draft', label: '신인 지명 계속하기' },
      trade: { href: '/?view=trade', label: '트레이드 답변 확인' },
    };
    return { reason: describePreseasonSkipBlockers(blocks), ...destinations[first.kind] };
  }
  const inbox = matchInboxDecision(g);
  if (g.engagement?.seriesRun?.status !== 'running' && inbox) return inbox;
  const report = g.news.find((n) => !n.read && importantCareerReport(g, n));
  if (report)
    return {
      reason: '중요한 새 보고를 확인해 주세요.',
      href: `/?view=inbox&report=${encodeURIComponent(report.id)}`,
      label: '확인할 보고 보기',
    };
  return null;
}

export function seriesDelegationBlocker(g: GameState) {
  return seriesDelegationDecision(g)?.reason || '';
}
