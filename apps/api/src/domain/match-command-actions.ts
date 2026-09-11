import type { GameState } from '@dugout/shared/types';
import { matchCommandOptions } from '@dugout/shared/match-commands';
import { generateTimeline, MAX_MATCH_CHANGES, validateCursor } from './match-timeline';
import type { createMatchSimulator } from './match-simulation';

export function matchCommandAction(
  g: GameState,
  a: Record<string, unknown>,
  simulate: ReturnType<typeof createMatchSimulator>,
) {
  const live = g.liveMatch;
  if (!live) throw new Error('진행 중인 경기가 없습니다.');
  if (live.cards && !live.cards.selected)
    throw new Error('경기 시작 전에 카드 3장을 확정해 주세요.');
  if (!live.timeline || !live.prepared) generateTimeline(g, simulate);
  const cursor = validateCursor(live, a);
  if (cursor >= live.timeline!.log.length || live.finished)
    throw new Error('종료된 경기는 변경할 수 없습니다.');
  const commands = live.commands || [],
    past = commands.filter((c) => c.cursor < cursor);
  if (
    String(a.command).startsWith('steal') &&
    live.cards?.version === 2 &&
    live.cards.used?.some((use) => use.cursor === cursor)
  )
    throw new Error('카드를 사용한 타석은 타자·투수 사인으로 진행해 주세요.');
  if (a.type === 'cancelMatchCommand') {
    if (!commands.some((c) => c.cursor === cursor)) throw new Error('취소할 작전이 없습니다.');
    live.commands = past;
  } else {
    const option = matchCommandOptions(live, g.club, cursor).find((c) => c.kind === a.command);
    if (!option) throw new Error('지시할 작전을 확인해 주세요.');
    if (option.reason) throw new Error(option.reason);
    if (
      past.length + (live.changes?.length || 0) + (live.warmups?.length || 0) >=
      MAX_MATCH_CHANGES
    )
      throw new Error('한 경기의 변경 횟수를 초과했습니다.');
    live.commands = [...past, { cursor, kind: option.kind }];
  }
  const prefix = live.timeline!.log.slice(0, cursor);
  live.cursor = cursor;
  generateTimeline(g, simulate);
  if (JSON.stringify(prefix) !== JSON.stringify(live.timeline!.log.slice(0, cursor)))
    throw new Error('이미 진행된 타석은 변경할 수 없습니다.');
  return g;
}
