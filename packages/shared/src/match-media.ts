import type { GameState, Result } from './types';
import { gameDate } from './calendar';

export type MediaChoice = { id: 'support' | 'challenge' | 'calm'; tone: string; text: string };
export type MediaQuestion = {
  id: string;
  room: 'press' | 'team';
  speaker: string;
  text: string;
  topic: 'expectation' | 'selection' | 'result' | 'mistakes' | 'talk';
  choices: MediaChoice[];
};
export type MatchConversation = {
  key: string;
  stage: 'pre' | 'post';
  date: string;
  day: number;
  year: number;
  opponent: string;
  summary: string;
  outcome?: 'win' | 'loss' | 'draw';
  margin?: number;
  playerIds: string[];
  questions: MediaQuestion[];
};
export type ConversationRecord = MatchConversation & {
  answers: { id: string; choice: MediaChoice['id']; text: string }[];
  delegated?: string;
  reactions: { id: string; name: string; before: number; after: number; reason: string }[];
};
export type MatchMediaState = {
  preparedFor?: string;
  pending?: MatchConversation;
  journal: ConversationRecord[];
};
export const conversationKey = (g: GameState, pair: string[]) =>
  `${g.year}:${g.day}:${pair.join(':')}:${g.history.filter((r) => r.day === g.day && (r.date?.startsWith(String(g.year)) ?? true)).length}`;
const choices = (support: string, challenge: string, calm: string): MediaChoice[] => [
  { id: 'support', tone: '격려하며', text: support },
  { id: 'challenge', tone: '단호하게', text: challenge },
  { id: 'calm', tone: '차분하게', text: calm },
];
export function preMatchConversation(
  g: GameState,
  pair: string[],
  opponent: string,
): MatchConversation {
  const players = g.roster.filter((p) => g.lineup.includes(p.id) || p.id === g.starter);
  const starter = players.find((p) => p.id === g.starter);
  const recent = g.history.slice(0, 3),
    losses = recent.filter(
      (r) =>
        (r.home === g.club ? r.homeScore : r.awayScore) <
        (r.home === g.club ? r.awayScore : r.homeScore),
    ).length;
  const selection = starter
    ? starter.condition < 70
      ? `${starter.name} 선수의 컨디션이 ${Math.round(starter.condition)}%입니다. 무리한 등판이라는 우려에 어떻게 답하시겠습니까?`
      : `${starter.name} 선수가 선발입니다. 오늘 선발진에 가장 기대하는 것은 무엇인가요?`
    : '오늘 출전할 선수들에게 어떤 역할을 기대하십니까?';
  return {
    key: conversationKey(g, pair),
    stage: 'pre',
    date: gameDate(g),
    day: g.day,
    year: g.year,
    opponent,
    summary: `${opponent}전 · ${g.phase === 'preseason' ? '연습경기' : '공식 경기'}${recent.length ? ` · 최근 ${recent.length}경기 ${losses}패` : ''}`,
    playerIds: players.map((p) => p.id),
    questions: [
      {
        id: 'expectation',
        room: 'press',
        speaker: '구단 출입 기자',
        topic: 'expectation',
        text:
          losses >= 2
            ? `최근 ${recent.length}경기에서 ${losses}패입니다. ${opponent}전에서 분위기를 바꿀 수 있을까요?`
            : `${opponent}전을 앞두고 있습니다. 오늘 경기에 임하는 각오를 들려주시겠습니까?`,
        choices: choices(
          '선수들을 믿습니다. 자신 있게 자기 야구를 보여주면 됩니다.',
          '결과로 보여줘야 합니다. 오늘은 집중력과 승리를 요구하겠습니다.',
          '상대를 존중합니다. 한 타석, 한 이닝씩 계획대로 풀겠습니다.',
        ),
      },
      {
        id: 'selection',
        room: 'press',
        speaker: '중계 기자',
        topic: 'selection',
        text: selection,
        choices: choices(
          '출전하는 선수들을 지지합니다. 부담을 나누고 벤치에서도 돕겠습니다.',
          '기용에는 책임이 따릅니다. 선택받은 선수들이 기대에 답해야 합니다.',
          '경기 중 몸 상태와 흐름을 확인하며 교체 시점을 판단하겠습니다.',
        ),
      },
      {
        id: 'team-talk',
        room: 'team',
        speaker: '라커룸 · 선수단',
        topic: 'talk',
        text: '취재진이 나갔습니다. 그라운드로 나설 선수들에게 마지막으로 어떤 말을 건네시겠습니까?',
        choices: choices(
          '여기 있는 모두를 믿는다. 실수하더라도 고개를 들고 다음 플레이를 하자.',
          '우리의 기준을 보여주자. 마지막 아웃까지 집중력을 놓지 마라.',
          '수비 위치와 사인을 확인하자. 준비한 플레이를 하나씩 해내면 된다.',
        ),
      },
    ],
  };
}
export function postMatchConversation(
  g: GameState,
  result: Result,
  opponent: string,
): MatchConversation {
  const side = result.home === g.club ? 1 : 0,
    own = side ? result.homeScore : result.awayScore,
    against = side ? result.awayScore : result.homeScore;
  const outcome = own > against ? 'win' : own < against ? 'loss' : 'draw',
    errors = result.errors[side] || 0;
  const team = result.replayTeams?.[side];
  const appeared = new Set(team?.lineup || g.lineup);
  if (team?.defense.P) appeared.add(team.defense.P);
  for (const event of result.log)
    if (event.play) {
      if (event.half === side) appeared.add(event.play.batter);
      else appeared.add(event.play.pitcher);
    }
  return {
    key: `post:${result.id}`,
    stage: 'post',
    date: result.date || gameDate(g, result.day),
    day: result.day,
    year: g.year,
    opponent,
    summary: `${opponent}전 ${own} : ${against} · ${outcome === 'win' ? '승리' : outcome === 'loss' ? '패배' : '무승부'}`,
    outcome,
    margin: own - against,
    playerIds: [...appeared],
    questions: [
      {
        id: 'result',
        room: 'press',
        speaker: '구단 출입 기자',
        topic: 'result',
        text: `${own} 대 ${against}로 ${outcome === 'win' ? '승리했습니다' : outcome === 'loss' ? '패했습니다' : '비겼습니다'}. 오늘 결과를 어떻게 평가하십니까?`,
        choices: choices(
          outcome === 'win'
            ? '선수들이 계획을 잘 실행했습니다. 오늘의 공은 선수들에게 돌리겠습니다.'
            : '결과는 아쉽지만 선수들이 포기하지 않았습니다. 다시 일어설 수 있게 돕겠습니다.',
          '결과와 별개로 더 나아져야 합니다. 부족했던 플레이는 분명히 짚겠습니다.',
          outcome === 'loss'
            ? '경기 운영의 책임은 감독에게 있습니다. 준비와 선택을 돌아보겠습니다.'
            : '좋았던 점과 부족했던 점을 함께 검토하고 다음 경기를 준비하겠습니다.',
        ),
      },
      {
        id: 'details',
        room: 'press',
        speaker: '경기 분석 기자',
        topic: errors ? 'mistakes' : 'result',
        text: errors
          ? `수비 실책 ${errors}개가 나왔습니다. 수비진에 어떤 메시지를 전하시겠습니까?`
          : `오늘 경기 MVP는 ${result.mvp || '기록 확인 중'}입니다. 팀의 경기 내용에서 무엇을 강조하시겠습니까?`,
        choices: choices(
          errors
            ? '누구나 실수할 수 있습니다. 동료를 믿고 함께 보완하는 것이 우선입니다.'
            : '좋은 플레이는 선수의 노력과 동료들의 도움에서 나옵니다. 우리 팀의 강점도 더 살리겠습니다.',
          errors
            ? '프로라면 다음 경기에는 개선된 모습을 보여야 합니다. 훈련에서 확인하겠습니다.'
            : '한 선수에게만 의존할 수는 없습니다. 모든 포지션에서 집중력을 보여줘야 합니다.',
          errors
            ? '장면별 원인을 분석하겠습니다. 오늘 한 경기만으로 선수를 단정하지 않겠습니다.'
            : '개인의 기록과 팀 전체의 수행을 함께 보겠습니다. 좋았던 장면은 다음 준비에 활용하겠습니다.',
        ),
      },
      {
        id: 'team-talk',
        room: 'team',
        speaker: '라커룸 · 선수단',
        topic: 'talk',
        text: `선수들이 ${outcome === 'win' ? '승리의 기쁨을 나누며' : outcome === 'loss' ? '아쉬운 표정으로' : '다음 승부를 생각하며'} 감독의 말을 기다리고 있습니다.`,
        choices: choices(
          outcome === 'win'
            ? '잘했다. 오늘의 노력과 집중력에 박수를 보낸다. 충분히 회복하고 다시 준비하자.'
            : '고개를 들자. 우리는 한 팀이다. 충분히 쉬고 다음 경기에서 답하자.',
          '우리가 할 수 있는 수준에 만족하지 말자. 다음 경기에는 더 높은 기준을 요구하겠다.',
          '오늘의 이야기는 여기서 정리하자. 회복과 다음 경기 준비에 집중하자.',
        ),
      },
    ],
  };
}
