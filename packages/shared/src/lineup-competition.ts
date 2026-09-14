export type CompetitionChoice = 'compete' | 'backProspect' | 'mediate';
export type CompetitionPlayer = {
  id: string;
  name: string;
  starts: number;
  ab: number;
  h: number;
  hr: number;
};
export type LineupCompetition = {
  id: string;
  club: string;
  created: string;
  status: 'decision' | 'trial' | 'resolved';
  choice?: CompetitionChoice;
  veteran: CompetitionPlayer;
  prospect: CompetitionPlayer;
  mediator?: { id: string; name: string };
  evidence: string;
  games: number;
  observed: string[];
  mediation?: boolean;
  resolved?: string;
  outcome?: string;
  kept?: boolean;
};
export const competitionChoices: Record<
  CompetitionChoice,
  { label: string; detail: string; veteran: number; prospect: number }
> = {
  compete: {
    label: '공개 주전 경쟁',
    detail:
      '다음 6경기 동안 두 선수에게 각각 선발 2경기 이상을 보장합니다. 실제 성적도 함께 평가합니다.',
    veteran: 2,
    prospect: 2,
  },
  backProspect: {
    label: '유망주를 계속 믿는다',
    detail:
      '다음 6경기 중 유망주 선발 4경기 이상을 약속합니다. 베테랑의 역할은 로테이션으로 바뀌고 당장은 사기가 떨어집니다.',
    veteran: 0,
    prospect: 4,
  },
  mediate: {
    label: '고참에게 중재를 맡긴다',
    detail:
      '중재 선수가 역할을 조율합니다. 다음 6경기 동안 두 선수에게 선발 1경기씩은 줘야 하며 설득이 통하지 않을 수도 있습니다.',
    veteran: 1,
    prospect: 1,
  },
};
export function competitionLine(p: CompetitionPlayer) {
  return `${p.name} · 선발 ${p.starts}경기 · ${p.ab}타수 ${p.h}안타 · 홈런 ${p.hr}개`;
}
