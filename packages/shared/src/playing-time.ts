import type { GameState, Player } from './types';

/** Playing time is a distinct concern from morale after defeats or workload fatigue. */
export function playingTimeAssessment(g: Pick<GameState, 'phase' | 'pitching'>, p: Player) {
  const recent = p.mood?.recent || [];
  const sample = recent.length,
    played = recent.filter(Boolean).length;
  if (
    g.phase === 'preseason' ||
    g.phase === 'finished' ||
    p.squad === 'reserve' ||
    p.injury ||
    p.condition < 65 ||
    p.mood?.role === 'prospect'
  )
    return null;
  if (sample < (p.pos === 'P' ? 12 : 8)) return null;
  // Save/setup opportunities depend on the score. Club game count alone cannot establish neglect.
  if (p.pos === 'P' && (g.pitching?.closer === p.id || g.pitching?.setup?.includes(p.id)))
    return null;
  const starting = p.pos === 'P' && g.pitching?.rotation.includes(p.id);
  const expected =
    p.pos === 'P'
      ? starting
        ? Math.floor(sample / 6)
        : 1
      : Math.ceil(
          sample *
            { core: 0.65, regular: 0.5, rotation: 0.2, prospect: 0 }[p.mood?.role || 'rotation'],
        );
  const role =
    p.pos === 'P'
      ? starting
        ? '선발 로테이션'
        : '중간 계투'
      : { core: '핵심 선수', regular: '주전', rotation: '로테이션', prospect: '유망주' }[
          p.mood?.role || 'rotation'
        ];
  return { sample, played, expected, role, shortage: played < expected };
}
