'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { preMatchConversation, type MatchConversation } from '@dugout/shared/match-media';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';

export function useConversationFocus(key: string | number) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [key]);
  return heading;
}
export function useMatchConversation(g: GameState) {
  const { nextFixture, getClub } = useWorld();
  const pair = nextFixture(g);
  const pre = pair
    ? preMatchConversation(g, pair, getClub(pair.find((id) => id !== g.club)!).name)
    : null;
  const context = g.media?.pending || pre;
  const [selected, setSelected] = useState<string | null>(null);
  const journal = g.media?.journal || [];
  const prior = selected ? journal.find((r) => r.key === selected) : undefined;
  const completed =
    prior || journal.find((r) => r.key === context?.key) || (!context ? journal[0] : undefined);
  return { context, selected, setSelected, journal, prior, completed, getClub };
}
export function useConversationForm(context: MatchConversation, act: Act, busy: boolean) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = context.questions[at];
  const selected = answers[question.id];
  const last = at === context.questions.length - 1;
  const questionHeading = useConversationFocus(at);
  const submit = async () => {
    if (busy || !selected) return;
    if (!last) {
      setAt(at + 1);
      return;
    }
    await act({
      type: 'matchConversation',
      stage: context.stage,
      key: context.key,
      answers: context.questions.map((q) => ({ id: q.id, choice: answers[q.id] })),
    });
  };
  return {
    at,
    setAt,
    answers,
    selected,
    last,
    question,
    questionHeading,
    submit,
    choose: (id: string) => setAnswers((old) => ({ ...old, [question.id]: id })),
    delegate: () =>
      act({ type: 'matchConversation', stage: context.stage, key: context.key, delegated: true }),
  };
}
