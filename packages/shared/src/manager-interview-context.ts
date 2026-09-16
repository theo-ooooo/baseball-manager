import type { ManagerOffer } from './manager-career';
import type { InterviewProfile, InterviewQuestion } from './manager-interview';

/** Answer IDs stay stable for saved interviews; the board evaluates the actual career context. */
export function contextualInterviewQuestions(
  questions: InterviewQuestion[],
  profile: InterviewProfile,
  offer: ManagerOffer,
  club: string,
) {
  const career = questions.find((q) => q.id === 'career')!;
  const motivation = questions.find((q) => q.id === 'motivation')!;
  if (profile.kind === 'proven') {
    motivation.question = `이전 구단에서 ${profile.rank}위로 시즌을 마쳤습니다. ${club}에서 새로 이루고 싶은 것은 무엇입니까?`;
    career.topic = '성과 재현';
    career.question = `이전 성적 ${profile.rank}위${profile.targetRank ? ` · 목표 ${profile.targetRank}위` : ''}. 그 성과를 우리 선수단에서도 재현할 방법을 말씀해 주세요.`;
    career.answers = [
      {
        id: 'responsibility',
        text: '기존 방식을 그대로 옮기기보다 선수단을 진단하고 코치들과 역할부터 정하겠습니다.',
        score: 2,
        reaction: '새 선수단에 맞춰 조정하는 접근으로 기록하겠습니다.',
      },
      {
        id: 'confidence',
        text: '성과를 냈던 투수 운용과 주전 경쟁 원칙은 유지하고, 선수별 역할을 다시 짜겠습니다.',
        score: 4,
        reaction: '이전 성과에 근거한 구체적인 운영 원칙을 높이 평가합니다.',
      },
      {
        id: 'blame',
        text: '이전 구단보다 더 많은 지원이 있어야 같은 성과를 낼 수 있습니다.',
        score: -2,
        reaction: '성과는 인정하지만 지원 규모만으로 재현을 보장하기는 어렵습니다.',
      },
    ];
  } else if (profile.kind === 'rebuild') {
    const ending =
      profile.endKind === 'dismissal'
        ? '경질'
        : profile.endKind === 'nonrenewal'
          ? '재계약 없이 계약 만료'
          : '사임';
    motivation.question = `지난 구단에서 ${ending} 후 다시 도전하고 계십니다. ${club}을 선택한 이유는 무엇입니까?`;
    career.topic = '재도전 계획';
    career.question = `이전 성적은 ${profile.rank}위${profile.targetRank ? `, 약속한 목표는 ${profile.targetRank}위` : ''}였습니다. 시즌 초반부터 뒤처진다면 무엇부터 바꾸겠습니까?`;
    career.answers = [
      {
        id: 'responsibility',
        text: '연패 원인을 타선·불펜으로 나눠 점검하고, 부진한 주전의 역할과 등판 간격부터 조정하겠습니다.',
        score: 4,
        reaction: '실패 원인과 첫 조치가 분명합니다. 재도전 계획을 긍정적으로 평가합니다.',
      },
      {
        id: 'confidence',
        text: '성적이 흔들려도 기존 주전과 제 방식을 끝까지 믿겠습니다.',
        score: -2,
        reaction: '일관성은 필요하지만 이전과 같은 문제가 생길 때의 대안이 부족합니다.',
      },
      {
        id: 'blame',
        text: '구단이 즉시 전력을 더 데려와야 합니다. 지금 선수단만으로는 해결하기 어렵습니다.',
        score: -4,
        reaction: '추가 영입 전에도 감독이 할 수 있는 조치가 필요합니다.',
      },
    ];
  } else if (profile.kind === 'return') {
    career.topic = '복귀 구상';
    career.question = `이전 구단을 ${profile.endKind === 'nonrenewal' ? '계약 만료로' : '떠나기로 결정하고'} 나온 뒤 복귀를 준비하셨습니다. ${club}의 ${offer.targetRank}위 목표에 맞춰 무엇을 바꾸겠습니까?`;
    career.answers[0] = {
      id: 'responsibility',
      text: '이전 팀의 방식부터 고집하지 않고, 이번 목표에 필요한 주전과 육성 자리를 먼저 정하겠습니다.',
      score: 3,
      reaction: '지난 경험을 새 목표에 맞춰 조정한다는 계획으로 기록하겠습니다.',
    };
  } else if (profile.kind === 'first') {
    career.topic = '첫 시즌의 선택';
    career.question =
      '첫 감독 시즌입니다. 이름값 있는 주전이 부진하고 유망주가 좋은 모습을 보인다면 누구를 쓰겠습니까?';
    career.answers = [
      {
        id: 'responsibility',
        text: '코치의 최근 보고와 컨디션을 확인하고, 유망주에게 역할을 정해 기회를 주겠습니다.',
        score: offer.priority === 'youth' ? 4 : 3,
        reaction: '선발 근거와 선수에게 설명할 역할이 명확합니다.',
      },
      {
        id: 'confidence',
        text: '당장 승리가 필요합니다. 경험 많은 주전의 반등에 맡기겠습니다.',
        score: offer.priority === 'win' ? 3 : 0,
        reaction:
          offer.priority === 'win'
            ? '즉시 성적이라는 구단 방향과 맞습니다. 부진이 길어질 때는 조정도 필요합니다.'
            : '구단의 육성·운영 방향도 기용에 반영해 주십시오.',
      },
      {
        id: 'blame',
        text: '선수 기용은 코치에게 전부 맡기고 결과만 보고받겠습니다.',
        score: -3,
        reaction: '의견을 듣더라도 선수 기용의 최종 책임은 감독에게 있습니다.',
      },
    ];
  }
  const budget = questions.find((q) => q.id === 'budget')!;
  budget.question =
    offer.priority === 'budget'
      ? '지출을 줄여야 하는 시즌입니다. 전력 보강 요구와 운영 예산을 어떻게 맞추겠습니까?'
      : offer.priority === 'youth'
        ? '젊은 선수에게 기회를 주려면 당장 성적을 위한 영입도 참아야 합니다. 어느 예산으로 출발하겠습니까?'
        : `목표 ${offer.targetRank}위에 도전할 전력을 준비해야 합니다. 취임 예산을 어떻게 잡겠습니까?`;
  const extra = budget.answers.find((a) => a.id === 'extra')!;
  if (profile.kind === 'proven' && offer.priority !== 'budget') {
    extra.score = 1;
    extra.reaction =
      '이전 성과를 근거로 추가 지원을 검토하겠습니다. 선임되면 기준 예산의 10%를 더 배정합니다.';
  } else if (offer.priority === 'budget') {
    extra.score = -5;
    extra.reaction =
      '지출 억제 방침과 충돌하는 요청입니다. 합격 평가에는 불리하지만 선임되면 약속한 추가 예산을 배정합니다.';
  }
  const lean = budget.answers.find((a) => a.id === 'lean')!;
  lean.score = offer.priority === 'budget' ? 4 : offer.priority === 'win' ? -1 : 2;
  lean.reaction =
    offer.priority === 'win'
      ? '예산을 10% 줄여도 성적 목표는 유지됩니다. 즉시 전력이 필요한 시즌이라 우려가 있습니다.'
      : '운영 방향에 맞는 절감안입니다. 취임 예산은 약속대로 10% 줄어듭니다.';
  return questions;
}
