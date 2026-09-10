import type { LiveMatch } from './types';
export function bullpenState(live: LiveMatch, id: string, cursor: number) {
  const last = live.warmups?.filter((w) => w.playerId === id && w.cursor <= cursor).at(-1);
  if (!last || last.mode === 'standby') return { status: 'standby' as const, batters: 0 };
  const batters = (live.timeline?.log || live.result.log)
    .slice(last.cursor, cursor)
    .filter((e) => e.play?.plateAppearance !== false && e.play).length;
  return {
    status:
      batters < 2 ? ('warming' as const) : batters > 8 ? ('tired' as const) : ('ready' as const),
    batters,
  };
}
export const bullpenLabels = {
  standby: '대기',
  warming: '몸 푸는 중',
  ready: '투입 준비 완료',
  tired: '장시간 준비 · 피로',
};
