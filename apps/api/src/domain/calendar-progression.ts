import type { DayProgress, GameState } from '@dugout/shared/types';

export function createCalendarProgression(
  nextFixture: (g: GameState) => string[] | null | undefined,
  advance: (g: GameState, count: number) => GameState,
) {
  function step(g: GameState, simulateGames = false) {
    const before = new Set(g.news.map((n) => n.id));
    const phase = g.phase;
    const progress: DayProgress = { from: g.day, to: g.day, stop: null, newsIds: [] };
    const decisions = g.news.filter((n) => n.choiceKind && !n.choice);
    if (decisions.length) {
      progress.stop = 'decision';
      progress.newsIds = decisions.map((n) => n.id);
    } else if (g.phase === 'finished') progress.stop = 'season';
    else if (!simulateGames && nextFixture(g)) progress.stop = 'fixture';
    else {
      advance(g, 1);
      progress.to = g.day;
      progress.newsIds = g.news.filter((n) => !before.has(n.id)).map((n) => n.id);
      progress.stop = g.news.some((n) => n.choiceKind && !n.choice)
        ? 'decision'
        : phase !== g.phase
          ? 'season'
          : progress.newsIds.length
            ? 'report'
            : nextFixture(g)
              ? 'fixture'
              : null;
    }
    g.progress = progress;
    return g;
  }
  function untilEvent(g: GameState) {
    // Preserve the existing one-game command for older clients. New clients use daily steps.
    if (nextFixture(g)) return step(g, true);
    for (let i = 0; i < 45; i++) {
      step(g);
      if (g.progress!.stop) break;
    }
    return g;
  }
  return { step, untilEvent };
}
