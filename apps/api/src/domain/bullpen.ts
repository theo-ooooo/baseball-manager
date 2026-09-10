import type { GameState } from '@dugout/shared/types';
import { bullpenState } from '@dugout/shared/bullpen';
import { isAvailable } from '@dugout/shared/long-term';
import { MAX_MATCH_CHANGES, validateCursor, visibleResult } from './match-timeline';
export function bullpenAction(g: GameState, a: Record<string, unknown>) {
  const live = g.liveMatch;
  if (!live?.bullpenVersion || !live.timeline || !live.prepared || live.finished)
    throw new Error('진행 중인 새 경기에서 불펜 지시를 사용할 수 있습니다.');
  const cursor = validateCursor(live, a),
    p = g.roster.find((p) => p.id === a.id);
  if (
    cursor >= live.timeline.log.length ||
    !p ||
    p.pos !== 'P' ||
    p.squad === 'reserve' ||
    !isAvailable(p)
  )
    throw new Error('출전 가능한 불펜 투수를 선택해 주세요.');
  const own = live.home === g.club ? 1 : 0;
  const used = new Set([
    live.prepared.input.starter,
    ...live.timeline.log
      .slice(0, cursor)
      .filter((e) => e.half !== own && e.play)
      .map((e) => e.play!.pitcher),
  ]);
  if (used.has(p.id)) throw new Error('이미 등판한 투수는 불펜 준비를 할 수 없습니다.');
  if (!['warm', 'standby'].includes(String(a.mode)))
    throw new Error('몸 풀기 또는 대기를 선택해 주세요.');
  const current = bullpenState(live, p.id, cursor);
  if (a.mode === 'warm' && current.status !== 'standby')
    throw new Error('이미 몸을 풀고 있습니다.');
  if (
    (live.warmups?.length || 0) + (live.changes?.length || 0) + (live.commands?.length || 0) >=
    MAX_MATCH_CHANGES
  )
    throw new Error('불펜 지시 횟수를 초과했습니다.');
  if (
    a.mode === 'warm' &&
    g.roster.filter((p) => !used.has(p.id) && bullpenState(live, p.id, cursor).status !== 'standby')
      .length >= 2
  )
    throw new Error('동시에 두 명까지 몸을 풀 수 있습니다.');
  (live.warmups ??= []).push({ playerId: p.id, cursor, mode: a.mode as 'warm' | 'standby' });
  live.cursor = cursor;
  live.result = visibleResult(live, cursor);
  return g;
}
