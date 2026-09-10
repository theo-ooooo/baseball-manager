import { isClubDutyReport } from '@dugout/shared/employment-reports';
import type { ManagerConversationState } from '@dugout/shared/manager-commands';
import { isManagerConversationCommand } from '@dugout/shared/manager-commands';
import { managerInterviewQuestions } from '@dugout/shared/manager-interview';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { teamBudget } from '@dugout/shared/game-view';
import { postNews } from './club-dynamics';
import { managerContractAction } from './manager-contracts';

/** Shared by full-save actions and the bounded D1 conversation path. */
export function managerConversationAction<T extends ManagerConversationState>(
  g: T,
  a: Record<string, unknown>,
  club: { name: string; league: string; count: number },
): T | null {
  if (!isManagerConversationCommand(a.type)) return null;
  if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
  if (g.managerCareer?.status === 'unemployed')
    for (const news of g.news)
      if (isClubDutyReport(news)) {
        news.read = true;
        news.employmentClosed = true;
      }
  const contract = managerContractAction(g, a);
  if (contract) return contract;
  const m = g.managerCareer;
  if (!m) throw new Error('먼저 커리어를 시작해 주세요.');
  function report(state: T, title: string, body: string, offer: ManagerOffer) {
    postNews(state, title, body, 'manager', {
      actionView: 'job-offers',
      managerOfferId: offer.id,
      sender: { name: `${club.name} 이사회`, role: '감독 선임 담당' },
    });
  }
  function finish(offer: ManagerOffer) {
    offer.status = 'pending';
    offer.due = addDays(gameDate(g), 2);
    offer.expires = addDays(gameDate(g), 14);
    offer.message =
      '면접을 마쳤습니다. 답변과 다른 후보들을 검토해 2일 뒤 최종 결과를 알려드리겠습니다.';
    report(g, `${club.name} · 면접 완료`, offer.message, offer);
  }
  // Keep the old command accepted for sessions already waiting at the removed proposal step.
  if (a.type === 'finishManagerInterview' || a.type === 'submitManagerProposal') {
    const offer = m.offers.find((o) => o.id === a.id);
    if (
      !offer ||
      offer.status !== 'interview' ||
      offer.expires < gameDate(g) ||
      offer.interview?.length !== managerInterviewQuestions(g, offer, club.name).length
    )
      throw new Error('면접 문항을 모두 마친 뒤 최종 심사로 진행해 주세요.');
    finish(offer);
    return g;
  }
  if (
    a.type === 'managerInterview' ||
    a.type === 'declineManager' ||
    a.type === 'acceptManagerInvite'
  ) {
    const offer = m.offers.find((o) => o.id === a.id);
    if (
      !offer ||
      !['invited', 'interview', 'offered', 'pending'].includes(offer.status) ||
      offer.expires < gameDate(g)
    )
      throw new Error('진행 중인 채용 제안이 없습니다.');
    if (a.type === 'declineManager') {
      offer.status = 'rejected';
      offer.message = '감독이 채용 절차를 철회했습니다.';
      return g;
    }
    if (a.type === 'acceptManagerInvite') {
      if (offer.status !== 'invited') throw new Error('유효한 면접 초청이 없습니다.');
      offer.status = 'interview';
      offer.message = `초청에 응해 주셔서 감사합니다. 우리 구단은 ${{ win: '당장의 성적 향상', youth: '젊은 선수 육성', budget: '안정적인 재정 운영' }[offer.priority || 'win']}을 중요하게 생각합니다. 어떤 계획을 갖고 계십니까?`;
      report(g, `${club.name} · 감독 면접`, offer.message, offer);
      return g;
    }
    if (offer.status !== 'interview') throw new Error('진행 중인 면접이 없습니다.');
    const questions = managerInterviewQuestions(g, offer, club.name);
    const question = questions[offer.interview?.length || 0];
    if (!question || a.question !== question.id)
      throw new Error('면접 질문이 변경됐습니다. 현재 질문에 답변해 주세요.');
    const answer = question.answers.find((x) => x.id === a.answer);
    if (!answer) throw new Error('면접 답변을 선택해 주세요.');
    (offer.interview ??= []).push({
      topic: question.topic,
      question: question.question,
      answer: answer.text,
      answerId: answer.id,
      reaction: answer.reaction,
      score: answer.score,
    });
    if (question.id === 'style') offer.answer = answer.id as 'win' | 'youth' | 'budget';
    if (question.id === 'target' && answer.id === 'ambitious') {
      offer.targetRank = Math.max(1, offer.targetRank - 1);
      offer.salary = Math.round(
        teamBudget(club.league) * (0.012 + ((club.count - offer.targetRank) / club.count) * 0.018),
      );
    }
    if (question.id === 'budget')
      offer.budgetAdjustment = answer.id === 'extra' ? 0.1 : answer.id === 'lean' ? -0.1 : 0;
    offer.message = answer.reaction;
    if (offer.interview.length === questions.length) finish(offer);
  }
  return g;
}
