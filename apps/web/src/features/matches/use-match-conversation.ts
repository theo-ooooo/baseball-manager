'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import {
  preMatchConversation,
  type MatchConversation,
  type ConversationRecord,
} from '@dugout/shared/match-media';
import { gameDate } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';

export function useConversationFocus(key: string | number) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const rect = heading.current?.getBoundingClientRect();
    if (rect && (rect.top < 70 || rect.bottom > window.innerHeight - 80))
      heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
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
  const [finished, setFinished] = useState<{ key: string; date: string; club: string } | null>(
    null,
  );
  const journal = g.media?.journal || [];
  const prior = selected ? journal.find((r) => r.key === selected) : undefined;
  const completed =
    prior ||
    (finished?.date === gameDate(g) && finished.club === g.club
      ? journal.find((r) => r.key === finished.key)
      : undefined) ||
    journal.find((r) => r.key === context?.key) ||
    (!context ? journal[0] : undefined);
  return {
    context,
    selected,
    setSelected,
    journal,
    prior,
    completed,
    getClub,
    finish: (key: string) => setFinished({ key, date: gameDate(g), club: g.club }),
  };
}
export function useConversationForm(
  context: MatchConversation,
  act: Act,
  busy: boolean,
  onComplete: (key: string) => void,
) {
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
    const result = await act({
      type: 'matchConversation',
      stage: context.stage,
      key: context.key,
      answers: context.questions.map((q) => ({ id: q.id, choice: answers[q.id] })),
    });
    if (result?.media?.journal.some((r) => r.key === context.key)) onComplete(context.key);
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
    delegate: async () => {
      const result = await act({
        type: 'matchConversation',
        stage: context.stage,
        key: context.key,
        delegated: true,
      });
      if (result?.media?.journal.some((r) => r.key === context.key)) onComplete(context.key);
    },
  };
}
export function useConversationReactions(record: ConversationRecord) {
  const [filter, setFilter] = useState('all');
  const tone = (r: ConversationRecord['reactions'][number]) =>
    r.after > r.before ? 'positive' : r.after < r.before ? 'negative' : 'neutral';
  const counts = { all: record.reactions.length, positive: 0, negative: 0, neutral: 0 };
  for (const r of record.reactions) counts[tone(r)]++;
  return {
    filter,
    setFilter,
    counts,
    tone,
    rows: record.reactions.filter((r) => filter === 'all' || tone(r) === filter),
  };
}
