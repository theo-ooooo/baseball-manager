import type { Player } from '@dugout/shared/types';
import type { MatchConversation, MediaChoice } from '@dugout/shared/match-media';

export function conversationReaction(
  player: Player,
  context: MatchConversation,
  answers: { id: string; choice: MediaChoice['id'] }[],
  delegated: boolean,
) {
  const before = player.mood!.value;
  let change = 0;
  for (const answer of answers) {
    const question = context.questions.find((q) => q.id === answer.id)!;
    if (answer.choice === 'support') {
      if (
        question.room === 'team' ||
        context.outcome === 'win' ||
        before < 55 ||
        player.condition < 65
      )
        change += 1;
    } else if (answer.choice === 'challenge') {
      change +=
        player.condition < 60 ||
        before < 50 ||
        player.age < 25 ||
        (context.outcome === 'win' && (context.margin || 0) >= 3)
          ? -1
          : 0.5;
    } else if (context.outcome === 'loss' && before < 60) change += 0.5;
  }
  const cap = delegated ? 1 : 2;
  change = Math.max(-cap, Math.min(cap, change * (delegated ? 0.5 : 1)));
  const after = Math.max(0, Math.min(100, before + change));
  const reason =
    after > before
      ? '감독의 메시지에 안정감과 의욕을 얻음'
      : after < before
        ? '요구 수준에 부담을 느낌'
        : '차분하게 메시지를 받아들임';
  return { id: player.id, name: player.name, before, after, reason };
}
