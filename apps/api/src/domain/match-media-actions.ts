import type { GameState, Result, WorldCatalog } from '@dugout/shared/types';
import { createGameView } from '@dugout/shared/game-view';
import {
  preMatchConversation,
  postMatchConversation,
  type MatchConversation,
  type ConversationRecord,
  type MediaChoice,
} from '@dugout/shared/match-media';
import { prepareDynamics, postNews } from './club-dynamics';
import { conversationReaction } from './match-media-reactions';

function recordConversation(
  g: GameState,
  context: MatchConversation,
  input: unknown,
  delegated: string | undefined,
  automatic = false,
) {
  if (g.media?.journal.some((r) => r.key === context.key))
    throw new Error('이미 마친 인터뷰입니다.');
  const answers = delegated
    ? context.questions.map((q) => ({ id: q.id, choice: 'calm' as const }))
    : input;
  if (
    !Array.isArray(answers) ||
    answers.length !== context.questions.length ||
    new Set(answers.map((a) => a?.id)).size !== context.questions.length
  )
    throw new Error('모든 질문과 팀 대화에 답변해 주세요.');
  const canonical = context.questions.map((q) => {
    const selected = answers.find((a) => a?.id === q.id);
    const choice = q.choices.find((c) => c.id === selected?.choice);
    if (!choice) throw new Error('질문에 맞는 답변을 선택해 주세요.');
    return { id: q.id, choice: choice.id, text: choice.text };
  });
  prepareDynamics(g);
  const players = g.roster.filter((p) => context.playerIds.includes(p.id));
  const reactions = players.map((p) => {
    const reaction = conversationReaction(p, context, canonical, !!delegated);
    if (automatic) {
      reaction.after = reaction.before;
      reaction.reason = '자동 진행 중 언론 담당자가 일정에 맞춰 응대함';
    }
    p.mood!.value = reaction.after;
    if (reaction.after !== reaction.before) p.mood!.reason = reaction.reason;
    return reaction;
  });
  const record: ConversationRecord = { ...context, answers: canonical, delegated, reactions };
  g.media ??= { journal: [] };
  g.media.journal = [record, ...g.media.journal].slice(0, 20);
  if (context.stage === 'pre') g.media.preparedFor = context.key;
  else delete g.media.pending;
  const pendingId = `media-pending:${context.key}`;
  const pending = g.news.find((n) => n.id === pendingId);
  if (pending) {
    pending.read = true;
    pending.response = '인터뷰와 팀 대화를 마쳤습니다.';
  }
  postNews(
    g,
    `${context.stage === 'pre' ? '경기 전' : '경기 후'} 인터뷰 · ${context.opponent}`,
    `${context.summary}\n${delegated ? `${delegated}에게 응대를 맡겼습니다.` : '감독의 인터뷰와 라커룸 메시지를 기록했습니다.'}`,
    'media',
    {
      id: `media:${context.key}`,
      day: context.day,
      year: context.year,
      date: context.date,
      read: true,
      actionView: 'media',
      sender: { name: '구단 홍보 담당', role: '인터뷰·선수단 반응 기록' },
      report: {
        facts: [
          { label: '긍정 반응', value: `${reactions.filter((r) => r.after > r.before).length}명` },
          {
            label: '부담을 느낌',
            value: `${reactions.filter((r) => r.after < r.before).length}명`,
          },
        ],
        sections: context.questions.map((q) => ({
          title: `${q.room === 'team' ? '라커룸' : '기자 질문'} · ${q.text}`,
          body: canonical.find((a) => a.id === q.id)!.text,
        })),
        players: reactions
          .filter((r) => r.after !== r.before)
          .map((r) => ({
            id: r.id,
            name: r.name,
            detail: `사기 ${r.before.toFixed(1)} → ${r.after.toFixed(1)} · ${r.reason}`,
          })),
      },
    },
  );
  return g;
}
export function finishPendingConversation(g: GameState) {
  if (g.media?.pending) recordConversation(g, g.media.pending, undefined, '구단 언론 담당', true);
}
export function queuePostMatchConversation(g: GameState, result: Result, world: WorldCatalog) {
  if (g.media?.journal.some((r) => r.key === `post:${result.id}`)) return;
  // Automatic/older clients can finish consecutive games; archive their prior briefing first.
  finishPendingConversation(g);
  const { getClub } = createGameView(world);
  const context = postMatchConversation(
    g,
    result,
    getClub(result.home === g.club ? result.away : result.home).name,
  );
  g.media ??= { journal: [] };
  g.media.pending = context;
  postNews(
    g,
    '경기 후 인터뷰와 라커룸 대화',
    `${context.summary}\n취재진과 선수단이 감독의 평가를 기다리고 있습니다.`,
    'media',
    {
      id: `media-pending:${context.key}`,
      date: context.date,
      day: context.day,
      year: context.year,
      actionView: 'media',
      sender: { name: '구단 홍보 담당', role: '경기 후 일정 안내' },
    },
  );
}
export function createMatchMediaActions(world: WorldCatalog) {
  const { nextFixture, getClub } = createGameView(world);
  return (g: GameState, a: Record<string, unknown>) => {
    if (a.type !== 'matchConversation') return null;
    if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
    let context: MatchConversation;
    if (a.stage === 'pre') {
      const pair = nextFixture(g);
      if (!pair) throw new Error('오늘 예정된 경기가 없습니다.');
      if (g.media?.pending) throw new Error('이전 경기 후 인터뷰를 먼저 마쳐 주세요.');
      context = preMatchConversation(g, pair, getClub(pair.find((id) => id !== g.club)!).name);
      if (g.media?.preparedFor === context.key) throw new Error('이미 마친 인터뷰입니다.');
    } else if (a.stage === 'post' && g.media?.pending) context = g.media.pending;
    else throw new Error('진행할 인터뷰가 없습니다.');
    if (a.key !== context.key)
      throw new Error('인터뷰 일정이 바뀌었습니다. 현재 질문을 다시 확인해 주세요.');
    const coach = g.staff.find((c) => c.role === '수석') || g.staff[0];
    if (a.delegated === true && !coach) throw new Error('위임할 코치가 없습니다.');
    return recordConversation(
      g,
      context,
      a.answers as { id: string; choice: MediaChoice['id'] }[],
      a.delegated === true ? `${coach.name} 코치` : undefined,
    );
  };
}
