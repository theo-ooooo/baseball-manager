import type { GameState } from './types';
import type { ManagerOffer } from './manager-career';
import { contextualInterviewQuestions } from './manager-interview-context';
export type InterviewProfile = {
  kind: 'first' | 'move' | 'proven' | 'rebuild' | 'return';
  rank?: number;
  targetRank?: number;
  endKind?: 'resignation' | 'nonrenewal' | 'dismissal';
};
export function managerInterviewProfile(g: Pick<GameState, 'managerCareer'>): InterviewProfile {
  const prior = g.managerCareer?.history[0];
  if (!prior) return { kind: g.managerCareer?.status === 'employed' ? 'move' : 'first' };
  const endKind = prior.endKind || (prior.reason === 'sacked' ? 'dismissal' : 'resignation');
  return {
    kind:
      endKind === 'dismissal' || (prior.targetRank !== undefined && prior.rank > prior.targetRank)
        ? 'rebuild'
        : prior.rank <= (prior.targetRank ?? 3)
          ? 'proven'
          : 'return',
    rank: prior.rank,
    targetRank: prior.targetRank,
    endKind,
  };
}
export type InterviewAnswer = { id: string; text: string; score: number; reaction: string };
export type InterviewQuestion = {
  id: string;
  topic: string;
  question: string;
  answers: InterviewAnswer[];
};
export type InterviewTurn = {
  topic: string;
  question: string;
  answer: string;
  answerId: string;
  reaction: string;
  score: number;
};
export function managerInterviewQuestions(
  g: Pick<GameState, 'managerCareer'>,
  o: ManagerOffer,
  clubName: string,
): InterviewQuestion[] {
  const prior = g.managerCareer?.history[0],
    employed = g.managerCareer?.status === 'employed';
  const questions: InterviewQuestion[] = [
    {
      id: 'motivation',
      topic: '지원 동기',
      question: `${clubName}의 감독직에 관심을 가진 이유가 무엇입니까?`,
      answers: [
        {
          id: 'project',
          text: '이 구단의 선수들과 오래 성과를 쌓고 싶습니다.',
          score: 2,
          reaction: '우리 구단의 미래를 함께 고민해 주신다는 점은 긍정적입니다.',
        },
        {
          id: 'challenge',
          text: '새로운 환경에서 제 능력을 증명하고 싶습니다.',
          score: 1,
          reaction: '새로운 도전을 원하는 이유는 이해했습니다.',
        },
        {
          id: 'career',
          text: '제 경력에서 더 높은 단계로 올라갈 기회입니다.',
          score: -1,
          reaction: '개인의 경력만큼 구단에 대한 헌신도 필요합니다.',
        },
      ],
    },
    {
      id: 'career',
      topic: '경력 · 책임',
      question: employed
        ? '현재도 다른 구단을 맡고 계십니다. 이직을 고려하는 이유를 설명해 주시겠습니까?'
        : prior?.reason === 'sacked'
          ? '이전 구단에서 계약이 종료됐습니다. 그 경험에서 무엇을 배웠습니까?'
          : prior
            ? '이전 구단을 떠난 뒤 어떤 팀을 찾고 계십니까?'
            : '감독으로서 이 구단을 이끌 준비가 되어 있다고 생각하십니까?',
      answers: [
        {
          id: 'responsibility',
          text: employed
            ? '현재 구단에서의 책임을 끝까지 지키며, 새 계약이 합의될 때 정식으로 인계하겠습니다.'
            : '제 경험과 부족했던 점을 인정합니다. 명확한 계획과 코치진의 협업으로 증명하겠습니다.',
          score: 3,
          reaction: '책임과 협업을 중요하게 생각하는 태도는 신뢰할 수 있습니다.',
        },
        {
          id: 'confidence',
          text: '기회만 주어진다면 제 능력을 결과로 보여드리겠습니다.',
          score: 1,
          reaction: '자신감은 알겠습니다. 구체적인 운영 계획도 듣고 싶습니다.',
        },
        {
          id: 'blame',
          text: '이전 환경과 지원이 부족했습니다. 충분한 지원부터 보장받고 싶습니다.',
          score: -3,
          reaction: '어려운 상황에서도 감독이 해결책을 찾을 수 있어야 합니다.',
        },
      ],
    },
    {
      id: 'style',
      topic: '선수단 운영',
      question: `우리 이사회는 ${{ win: '당장의 경쟁력과 성적', youth: '젊은 선수의 육성', budget: '재정에 맞는 효율적인 선수단' }[o.priority || 'win']}을 중요하게 생각합니다. 어떤 팀을 만들겠습니까?`,
      answers: [
        {
          id: 'win',
          text: '주전의 강점을 살리고 즉시 전력을 활용해 승리에 집중하겠습니다.',
          score: o.priority === 'win' ? 8 : -2,
          reaction:
            o.priority === 'win'
              ? '우리가 기대하는 방향과 일치합니다.'
              : '성적도 필요하지만, 구단이 전한 우선순위를 함께 고려해 주십시오.',
        },
        {
          id: 'youth',
          text: '2군 유망주에게 기회를 주고, 다음 세대를 키워 가겠습니다.',
          score: o.priority === 'youth' ? 8 : -2,
          reaction:
            o.priority === 'youth'
              ? '젊은 선수에게 기회를 주겠다는 계획이 마음에 듭니다.'
              : '육성 방향은 이해했습니다. 다른 운영 목표와 균형이 필요합니다.',
        },
        {
          id: 'budget',
          text: '중복 포지션과 고액 계약을 점검하고 효율적인 선수단을 만들겠습니다.',
          score: o.priority === 'budget' ? 8 : -2,
          reaction:
            o.priority === 'budget'
              ? '구단의 재정 상황을 이해하고 계시는군요.'
              : '비용 관리만으로 우리 구단의 모든 기대가 충족되지는 않습니다.',
        },
      ],
    },
    {
      id: 'target',
      topic: '시즌 기대',
      question: `이사회는 ${o.targetRank}위 이내를 기대합니다. 이 목표에 동의하십니까?`,
      answers: [
        {
          id: 'agree',
          text: '동의합니다. 제안하신 순위를 시즌 목표로 삼겠습니다.',
          score: 2,
          reaction: '시즌 목표에 합의한 것으로 기록하겠습니다.',
        },
        {
          id: 'ambitious',
          text: `더 높은 목표를 약속하겠습니다. ${Math.max(1, o.targetRank - 1)}위 이내에 도전하겠습니다.`,
          score: 3,
          reaction: '야심을 긍정적으로 봅니다. 더 높은 순위를 실제 계약 목표로 반영하겠습니다.',
        },
        {
          id: 'cautious',
          text: '취임 후 전력을 먼저 확인해야 합니다. 목표를 낮춰 주셨으면 합니다.',
          score: -4,
          reaction:
            '현재 제시한 기대를 낮추기는 어렵습니다. 목표를 받아들일 수 있는 다른 후보도 검토하겠습니다.',
        },
      ],
    },
    {
      id: 'budget',
      topic: '운영 예산',
      question: '현재 구단에 책정된 예산 안에서 운영할 수 있습니까?',
      answers: [
        {
          id: 'within',
          text: '현재 예산 안에서 우선순위를 정해 운영하겠습니다.',
          score: 2,
          reaction: '재정 범위를 이해해 주셔서 감사합니다.',
        },
        {
          id: 'extra',
          text: '기준 예산의 10%를 추가 지원해 주신다면 계획을 실현할 수 있습니다.',
          score: -3,
          reaction:
            '추가 지원 요청은 최종 선임 결정에 함께 반영하겠습니다. 채용 제안 시 지원금을 포함하겠습니다.',
        },
        {
          id: 'lean',
          text: '기준 예산의 10%를 줄여도 효율적인 운영으로 해내겠습니다.',
          score: 3,
          reaction: '절감 의지는 긍정적입니다. 최종 취임 예산에서 약속한 금액을 조정하겠습니다.',
        },
      ],
    },
    {
      id: 'staff',
      topic: '코치진',
      question: '현재 코치진과 함께 일할 수 있겠습니까?',
      answers: [
        {
          id: 'keep',
          text: '기존 코치진의 의견부터 듣고 역할을 배분하겠습니다.',
          score: 2,
          reaction: '안정적인 인수인계를 기대하겠습니다.',
        },
        {
          id: 'review',
          text: '취임 후 강점을 평가하고 부족한 역할만 보강하고 싶습니다.',
          score: 1,
          reaction: '합리적인 접근입니다. 취임 후 스태프 화면에서 계획을 실행해 주십시오.',
        },
        {
          id: 'replace',
          text: '제 방식에 맞는 코치진으로 크게 개편하고 싶습니다.',
          score: -3,
          reaction: '급격한 변화와 추가 비용이 우려됩니다. 이 요청도 선임 평가에 반영하겠습니다.',
        },
      ],
    },
  ];
  return contextualInterviewQuestions(
    questions,
    o.interviewProfile || managerInterviewProfile(g),
    o,
    clubName,
  );
}
