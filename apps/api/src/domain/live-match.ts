import { createAiRegistrations } from './ai-registrations';
import { bullpenAction } from './bullpen';
import type { WorldCatalog, GameState } from '@dugout/shared/types';
import { createGameView } from '@dugout/shared/game-view';
import type { createMatchSimulator } from './match-simulation';
import { generateTimeline, reviseTimeline, validateCursor, visibleResult } from './match-timeline';
import { matchCommandAction } from './match-command-actions';
import { finishPendingConversation, queuePostMatchConversation } from './match-media-actions';
import { gameDate } from '@dugout/shared/calendar';
import { postNews } from './club-dynamics';

type Advance = (game: GameState, count?: number, pauseAfterOwn?: boolean) => GameState;
export function createLiveMatchActions(
  world: WorldCatalog,
  simulateMatch: ReturnType<typeof createMatchSimulator>,
  advance: Advance,
) {
  const { nextFixture, rosterFor } = createGameView(world);
  const registrations = createAiRegistrations(world);
  function liveAction(g: GameState, a: Record<string, unknown>): GameState | null {
    if (a.type === 'bullpen') return bullpenAction(g, a);
    if (a.type === 'matchCommand' || a.type === 'cancelMatchCommand')
      return matchCommandAction(g, a, simulateMatch);
    if (a.type === 'delegateMatch') {
      if (g.managerCareer?.status === 'unemployed' || g.managerCareer?.vacationUntil)
        throw new Error('현재 구단에서 경기를 맡고 있을 때 위임할 수 있습니다.');
      if (a.date !== gameDate(g))
        throw new Error('경기 날짜가 바뀌었습니다. 오늘 일정을 다시 확인해 주세요.');
      if (
        !g.staff.some(
          (c) =>
            c.role !== '스카우트' && (c.contractUntil === undefined || c.contractUntil > g.year),
        )
      )
        throw new Error('경기를 맡길 코치를 먼저 선임해 주세요.');
    }
    if (a.type === 'startMatch' || (a.type === 'delegateMatch' && !g.liveMatch)) {
      if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
      if (g.news.some((n) => n.choiceKind && !n.choice))
        throw new Error('수신함의 필수 면담에 답변한 뒤 경기장으로 이동해 주세요.');
      const pair = nextFixture(g);
      if (!pair) throw new Error('오늘 경기가 없습니다. 계속 진행으로 다음 일정으로 이동하세요.');
      const [home, away] = pair;
      registrations.prepare(g, home, g.phase === 'regular');
      registrations.prepare(g, away, g.phase === 'regular');
      finishPendingConversation(g);
      g.liveMatch = {
        home,
        away,
        seed: g.seed,
        pitchingVersion: 3,
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
      if (a.type === 'startMatch') {
        generateTimeline(g, simulateMatch);
        return g;
      }
    }
    if (a.type === 'delegateMatch') {
      const live = g.liveMatch!;
      const coach =
        g.staff.find(
          (c) => c.role === '수석' && (c.contractUntil === undefined || c.contractUntil > g.year),
        ) ||
        g.staff.find(
          (c) =>
            c.role !== '스카우트' && (c.contractUntil === undefined || c.contractUntil > g.year),
        )!;
      const cursor = live.timeline ? validateCursor(live, a) : 0;
      if (live.timeline && a.playbackId !== live.playbackId)
        throw new Error('진행 중인 경기가 바뀌었습니다. 경기 화면을 다시 열어 주세요.');
      live.delegation = { coachId: coach.id, name: coach.name, cursor };
      live.cursor = cursor;
      generateTimeline(g, simulateMatch);
      const next = liveAction(g, {
        type: 'completeMatch',
        cursor: live.timeline!.log.length,
        timelineVersion: live.timelineVersion,
      })!;
      postNews(
        next,
        `${coach.name} 코치가 경기 지휘를 마쳤습니다`,
        '감독님, 맡겨주신 경기를 마쳤습니다. 제출된 선발 명단과 투수 운용 계획을 바탕으로 상황별 작전과 투수 교체를 진행했습니다.\n경기 기록에서 결과와 교체 내역을 확인해 주세요. 경기 후 인터뷰와 팀 대화도 이어서 진행할 수 있습니다.',
        'match',
        { sender: { name: coach.name, role: '경기 지휘 대행' }, actionView: 'media' },
      );
      return next;
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
