'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Result } from '@dugout/shared/types';
import { replayScene } from '@dugout/shared/replay';
import { useIsMobile } from '../../hooks/use-mobile';
import { useReplayClock } from './use-replay-clock';
import { matchCommentary, visibleMatchCues, type MatchCue } from './match-commentary';

export type StadiumSceneProps = {
  result: Result;
  index: number;
  playing: boolean;
  speed: number;
  reduced: boolean;
  onEnd: () => void;
  replayKey?: string | number;
  complete?: boolean;
  onCue?: (cue: MatchCue) => void;
};
export function useStadiumReplay({
  result,
  index,
  playing,
  speed,
  reduced,
  onEnd,
  replayKey = 0,
  complete = false,
  onCue,
}: StadiumSceneProps) {
  const animationKey = `${result.id}:${index}:${replayKey}`;
  const progress = useReplayClock({ animationKey, playing, speed, reduced, complete, onEnd });
  const scene = useMemo(() => replayScene(result, index), [result, index]);
  const mobile = useIsMobile();
  const [zoomOverride, setZoomOverride] = useState<boolean | null>(null);
  const zoom2d = zoomOverride ?? mobile;
  const cues = useMemo(() => matchCommentary(scene, animationKey), [scene, animationKey]);
  const callback = useRef(onCue);
  useEffect(() => {
    callback.current = onCue;
  }, [onCue]);
  const emitted = useRef({ key: animationKey, through: -1, started: false });
  useEffect(() => {
    if (emitted.current.key !== animationKey)
      emitted.current = { key: animationKey, through: -1, started: false };
    if (playing) emitted.current.started = true;
    if (!emitted.current.started || (!playing && progress < 1)) return;
    for (const cue of visibleMatchCues(cues, progress)) {
      if (cue.at > emitted.current.through) callback.current?.(cue);
    }
    emitted.current.through = progress;
  }, [animationKey, cues, playing, progress]);
  const currentCue = visibleMatchCues(cues, progress).at(-1);
  return {
    scene,
    progress,
    t: reduced ? (progress >= 1 ? 1 : 0) : progress,
    currentCue,
    zoom2d,
    setZoomOverride,
    fieldView: zoom2d ? '240 95 1056 930' : '0 0 1536 1024',
  };
}
