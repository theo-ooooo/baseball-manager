import type { GameState } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import { matchDecision } from '@dugout/shared/match-decision';
import type { createMatchSimulator } from './match-simulation';
import { generateTimeline, validateCursor, visibleResult } from './match-timeline';

/** Simulate the remainder of this inning and hand control back at the next inning. */
export function delegateInning(
  g: GameState,
  a: Record<string, unknown>,
  simulate: ReturnType<typeof createMatchSimulator>,
) {
  const live = g.liveMatch;
  if (!live?.timeline || !live.prepared || live.finished)
    throw new Error('진행 중인 경기에서 이닝을 맡길 수 있습니다.');
  if (g.managerCareer?.status === 'unemployed' || g.managerCareer?.vacationUntil)
    throw new Error('현재 구단에서 경기를 맡고 있을 때 위임할 수 있습니다.');
  if (a.date !== gameDate(g) || a.playbackId !== live.playbackId)
    throw new Error('진행 중인 경기가 바뀌었습니다. 경기 화면을 다시 열어 주세요.');
  if (live.cards && !live.cards.selected)
    throw new Error('경기 시작 전에 카드 3장을 확정해 주세요.');
  const available = g.staff.filter(
    (c) => c.role !== '스카우트' && (c.contractUntil === undefined || c.contractUntil > g.year),
  );
  const coach = available.find((c) => c.role === '수석') || available[0];
  if (!coach) throw new Error('경기를 맡길 코치를 먼저 선임해 주세요.');
  const cursor = validateCursor(live, a);
  const decision = matchDecision(live, g.club, cursor);
  if (decision.finished) throw new Error('종료된 경기는 변경할 수 없습니다.');
  const segments = live.inningDelegations || [];
  if (segments.length >= 18) throw new Error('한 경기의 이닝 위임 한도를 초과했습니다.');
  const prefix = live.timeline.log.slice(0, cursor);
  const segment = { coachId: coach.id, name: coach.name, cursor, inning: decision.inning };
  live.inningDelegations = [...segments, segment];
  live.cursor = cursor;
  generateTimeline(g, simulate);
  if (JSON.stringify(prefix) !== JSON.stringify(live.timeline.log.slice(0, cursor)))
    throw new Error('이미 진행된 타석은 변경할 수 없습니다. 이전 계획을 유지해 주세요.');
  const boundary = live.timeline.log.findIndex(
    (event, i) => i >= cursor && event.inning > decision.inning,
  );
  live.cursor = boundary < 0 ? live.timeline.log.length : boundary;
  live.inningDelegations.at(-1)!.endCursor = live.cursor;
  live.finished = live.cursor >= live.timeline.log.length;
  live.result = visibleResult(live, live.cursor);
  return g;
}
