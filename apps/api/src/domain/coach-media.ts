import type { GameState } from '@dugout/shared/types';
import type { MatchConversation, MediaChoice } from '@dugout/shared/match-media';

export function coachMediaAnswers(g: GameState, context: MatchConversation) {
  const players = g.roster.filter((p) => context.playerIds.includes(p.id));
  const vulnerable = players.some((p) => (p.mood?.value ?? 50) < 55 || p.condition < 65);
  const ready =
    players.length > 0 &&
    players.every((p) => p.age >= 25 && (p.mood?.value ?? 50) >= 70 && p.condition >= 75);
  return context.questions.map((q) => {
    let choice: MediaChoice['id'];
    if (context.outcome === 'win' || vulnerable) choice = 'support';
    else if (q.room === 'team') choice = context.stage === 'pre' && ready ? 'challenge' : 'support';
    else if (context.outcome === 'loss' || q.topic === 'mistakes' || q.topic === 'selection')
      choice = 'calm';
    else choice = ready && context.stage === 'pre' ? 'challenge' : 'support';
    return { id: q.id, choice: q.choices.some((c) => c.id === choice) ? choice : q.choices[0].id };
  });
}
