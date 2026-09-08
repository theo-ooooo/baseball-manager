import type { WorldCatalog, GameState } from '../../../../packages/shared/src/types';
import { createGameView, rng } from '../../../../packages/shared/src/game-view';
import type { createMatchSimulator } from './match-simulation';

type Advance = (game: GameState, count?: number, pauseAfterOwn?: boolean) => GameState;
export function createLiveMatchActions(
  world: WorldCatalog,
  simulateMatch: ReturnType<typeof createMatchSimulator>,
  advance: Advance,
) {
  const { nextFixture, rosterFor } = createGameView(world);
  function liveAction(g: GameState, a: Record<string, unknown>) {
    if (a.type === 'startMatch') {
      if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
      const pair = nextFixture(g);
      if (!pair) throw new Error('오늘 경기가 없습니다. 계속 진행으로 다음 일정으로 이동하세요.');
      const [home, away] = pair,
        iterator = simulateMatch(
          structuredClone(g),
          home,
          away,
          rng(g.seed),
          !['regular', 'preseason'].includes(g.phase),
        );
      const result = iterator.next().value;
      result.friendly = g.phase === 'preseason';
      g.liveMatch = {
        home,
        away,
        seed: g.seed,
        cursor: 0,
        finished: false,
        result,
        opponents: JSON.parse(
          JSON.stringify([
            away === g.club ? [] : rosterFor(g, away),
            home === g.club ? [] : rosterFor(g, home),
          ]),
        ),
      };
      return g;
    }
    if (a.type === 'stepMatch') {
      const live = g.liveMatch;
      if (!live || live.finished) return g;
      const iterator = simulateMatch(
        structuredClone(g),
        live.home,
        live.away,
        rng(live.seed),
        !['regular', 'preseason'].includes(g.phase),
      );
      let step = iterator.next();
      for (let i = 0; i <= live.cursor && !step.done; i++) step = iterator.next();
      live.cursor++;
      live.finished = !!step.done;
      live.result = step.value;
      live.result.friendly = g.phase === 'preseason';
      return g;
    }
    if (a.type === 'completeMatch') {
      if (!g.liveMatch?.finished) throw new Error('경기를 끝까지 진행해 주세요.');
      return advance(g, 1, true);
    }
    if (g.liveMatch && a.type !== 'syncCatalog')
      throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
    return null;
  }

  return liveAction;
}
