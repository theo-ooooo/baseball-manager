import type { GameState } from '@dugout/shared/types';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { managerInterviewQuestions } from '@dugout/shared/manager-interview';
import { gameDate } from '@dugout/shared/calendar';

export function managerOfferActionLabel(offer: ManagerOffer | undefined, g: GameState) {
  if (!offer || offer.expires < gameDate(g) || ['expired', 'rejected'].includes(offer.status))
    return '채용 기록 확인';
  if (offer.status === 'offered') {
    if (offer.contractTerms?.status === 'agreed') return '최종 계약서 서명';
    if (offer.contractTerms?.status === 'pending') return '계약 검토 현황';
    return '계약 협상';
  }
  if (offer.status === 'invited') return '면접 초청 확인';
  if (offer.status === 'interview')
    return (offer.interview?.length || 0) >= managerInterviewQuestions(g, offer, '').length
      ? '면접 마치기'
      : '면접 참석';
  return offer.answer ? '최종 심사 현황' : '지원 현황 확인';
}
