import type { DefensivePosition, Result } from '@dugout/shared/types';
import { hash } from '@dugout/shared/game-view';
export type Point = { x: number; y: number };
// Coordinates match the overhead stadium art. The motion illustrates logged outcomes.
export const bases: Point[] = [
  { x: 768, y: 867 },
  { x: 1011, y: 633 },
  { x: 768, y: 437 },
  { x: 525, y: 633 },
  { x: 768, y: 867 },
];
export const fieldPoints: Record<string, Point> = {
  P: { x: 768, y: 643 },
  C: { x: 768, y: 921 },
  '1B': { x: 1035, y: 576 },
  '2B': { x: 880, y: 446 },
  SS: { x: 635, y: 445 },
  '3B': { x: 499, y: 576 },
  LF: { x: 429, y: 325 },
  CF: { x: 768, y: 211 },
  RF: { x: 1107, y: 325 },
};
export const playKind = (text: string) =>
  text.includes('홈런')
    ? 'homeRun'
    : text.includes('3루타')
      ? 'triple'
      : text.includes('2루타')
        ? 'double'
        : text.includes('안타')
          ? 'single'
          : text.includes('볼넷')
            ? 'walk'
            : text.includes('삼진')
              ? 'strikeout'
              : text.includes('병살')
                ? 'doublePlay'
                : text.includes('실책')
                  ? 'error'
                  : text.includes('희생')
                    ? 'sacrifice'
                    : text.includes('승부치기')
                      ? 'tiebreak'
                      : 'out';
export function replayScene(result: Result, index: number) {
  const event = result.log[index],
    kind = playKind(event?.text || '');
  const play = event?.play;
  const seed = hash(result.id + ':' + index),
    fly = ['single', 'double', 'triple', 'homeRun', 'sacrifice'].includes(kind);
  const fielder: DefensivePosition = fly
    ? (['LF', 'CF', 'RF'] as const)[seed % 3]
    : (['SS', '2B', '3B'] as const)[seed % 3];
  const target = { ...fieldPoints[fielder] };
  if (['double', 'triple', 'homeRun'].includes(kind)) {
    target.y -= kind === 'homeRun' ? 155 : 70;
    target.x += (seed % 2 ? 1 : -1) * 45;
  }
  const batting = result.replayTeams?.[event?.half || 0],
    defending = result.replayTeams?.[event?.half === 0 ? 1 : 0];
  const playerName = (id: string) =>
    batting?.players.find((p) => p.id === id)?.name ||
    defending?.players.find((p) => p.id === id)?.name ||
    '';
  const runners: { id: string; name: string; from: number; to: number; out: boolean }[] = [];
  if (play) {
    let scorers = play.after.score[event.half] - play.before.score[event.half];
    const starting = [
      ...play.before.bases.map((id, i) => ({ id, from: i + 1 })),
      { id: play.batter, from: 0 },
    ]
      .filter((r): r is { id: string; from: number } => !!r.id)
      .sort((a, b) => b.from - a.from);
    for (const runner of starting) {
      const at = play.after.bases.indexOf(runner.id);
      let to = at >= 0 ? at + 1 : runner.from,
        out = false;
      if (at < 0) {
        if (play.steal?.runner === runner.id && !play.steal.safe) {
          to = 2;
          out = true;
        } else if (kind === 'doublePlay') {
          to = runner.from === 0 ? 1 : 2;
          out = true;
        } else if (scorers > 0) {
          to = 4;
          scorers--;
        } else if (runner.from === 0) {
          to = kind === 'strikeout' ? 0 : 1;
          out = true;
        }
      }
      runners.push({ ...runner, name: playerName(runner.id), to, out });
    }
  }
  const batter = play
    ? playerName(play.batter)
    : event?.text.split(/ (?:홈런|안타|2루타|3루타|볼넷|삼진|병살타|범타|수비|희생)/)[0] || '';
  return {
    event,
    kind,
    play,
    target,
    fielder,
    batting,
    defending,
    runners,
    batter,
    pitcher: play ? playerName(play.pitcher) : '',
    fly,
  };
}
export function between(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function runnerPoint(from: number, to: number, t: number) {
  const distance = Math.max(0, to - from),
    at = from + distance * t,
    index = Math.min(4, Math.floor(at));
  return index === 4 ? bases[4] : between(bases[index], bases[index + 1], at - index);
}
export function ballPoint(scene: ReturnType<typeof replayScene>, progress: number): Point {
  if (progress < 0.2) return between(fieldPoints.P, bases[0], progress / 0.2);
  if (['walk', 'strikeout', 'tiebreak'].includes(scene.kind))
    return between(bases[0], fieldPoints.C, Math.min(1, (progress - 0.2) / 0.2));
  if (progress < 0.65) return between(bases[0], scene.target, (progress - 0.2) / 0.45);
  if (['homeRun', 'double', 'triple'].includes(scene.kind)) return scene.target;
  const destination =
    scene.kind === 'doublePlay'
      ? bases[2]
      : ['out', 'error'].includes(scene.kind)
        ? bases[1]
        : fieldPoints.P;
  return between(scene.target, destination, Math.min(1, (progress - 0.65) / 0.25));
}
