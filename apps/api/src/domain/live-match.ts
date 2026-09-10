import { bullpenAction } from './bullpen';
import type { WorldCatalog, GameState } from '@dugout/shared/types';
import { createGameView } from '@dugout/shared/game-view';
import type { createMatchSimulator } from './match-simulation';
import { generateTimeline, reviseTimeline, validateCursor, visibleResult } from './match-timeline';
import { matchCommandAction } from './match-command-actions';
import { finishPendingConversation, queuePostMatchConversation } from './match-media-actions';

type Advance = (game: GameState, count?: number, pauseAfterOwn?: boolean) => GameState;
export function createLiveMatchActions(
  world: WorldCatalog,
  simulateMatch: ReturnType<typeof createMatchSimulator>,
  advance: Advance,
) {
  const { nextFixture, rosterFor } = createGameView(world);
  function liveAction(g: GameState, a: Record<string, unknown>) {
    if (a.type === 'bullpen') return bullpenAction(g, a);
    if (a.type === 'matchCommand' || a.type === 'cancelMatchCommand')
      return matchCommandAction(g, a, simulateMatch);
    if (a.type === 'startMatch') {
      if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
      if (g.news.some((n) => n.choiceKind && !n.choice))
        throw new Error('수신함의 필수 면담에 답변한 뒤 경기장으로 이동해 주세요.');
      const pair = nextFixture(g);
      if (!pair) throw new Error('오늘 경기가 없습니다. 계속 진행으로 다음 일정으로 이동하세요.');
      const [home, away] = pair;
      finishPendingConversation(g);
      g.liveMatch = {
        home,
        away,
        seed: g.seed,
        pitchingVersion: 2,
        energyVersion: 1,
        bullpenVersion: 1,
        warmups: [],
        cursor: 0,
        finished: false,
        result: {
          id: '',
          day: g.day,
          home,
          away,
          homeScore: 0,
          awayScore: 0,
          innings: [],
          hits: [],
          errors: [],
          log: [],
          mvp: '',
        },
        opponents: structuredClone([
          away === g.club ? [] : rosterFor(g, away),
          home === g.club ? [] : rosterFor(g, home),
        ]),
      };
      generateTimeline(g, simulateMatch);
      return g;
    }
    if (a.type === 'prepareMatch' || a.type === 'stepMatch' || a.type === 'matchCursor') {
      const live = g.liveMatch;
      if (!live) throw new Error('진행 중인 경기가 없습니다.');
      // Upgrade an old partial game once, on an explicit command, never while reading/SSR.
      if (!live.timeline || !live.prepared) generateTimeline(g, simulateMatch);
      if (a.type === 'prepareMatch') return g;
      const cursor =
        a.type === 'stepMatch'
          ? Math.min(live.cursor + 1, live.timeline!.log.length)
          : validateCursor(live, a);
      live.cursor = cursor;
      live.finished = cursor >= live.timeline!.log.length;
      live.result = visibleResult(live, cursor);
      return g;
    }
    if (a.type === 'reviseMatch') {
      if (!g.liveMatch) throw new Error('진행 중인 경기가 없습니다.');
      return reviseTimeline(g, a, simulateMatch);
    }
    if (a.type === 'completeMatch') {
      const live = g.liveMatch;
      if (!live) throw new Error('진행 중인 경기가 없습니다.');
      if (!live.timeline || !live.prepared) generateTimeline(g, simulateMatch);
      const cursor = validateCursor(live, a);
      if (cursor < live.timeline!.log.length) throw new Error('경기를 끝까지 진행해 주세요.');
      live.finished = true;
      const before = new Set(g.history.map((result) => result.id));
      const next = advance(g, 1, true);
      const result = next.history.find((result) => !before.has(result.id));
      if (result && next.managerCareer?.status !== 'unemployed')
        queuePostMatchConversation(next, result, world);
      return next;
    }
    if (g.liveMatch && a.type !== 'syncCatalog')
      throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
    return null;
  }
  return liveAction;
}
