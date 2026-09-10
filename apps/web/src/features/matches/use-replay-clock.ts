'use client';
import { useEffect, useRef, useState } from 'react';

export function useReplayClock({
  animationKey,
  playing,
  speed,
  reduced,
  complete,
  onEnd,
}: {
  animationKey: string;
  playing: boolean;
  speed: number;
  reduced: boolean;
  complete: boolean;
  onEnd: () => void;
}) {
  const [frame, setFrame] = useState({ key: animationKey, progress: complete ? 1 : 0 });
  const clock = useRef({ key: animationKey, elapsed: complete ? 4200 : 0, ended: complete });
  const callback = useRef(onEnd);
  useEffect(() => {
    callback.current = onEnd;
  }, [onEnd]);
  useEffect(() => {
    if (clock.current.key !== animationKey)
      clock.current = { key: animationKey, elapsed: complete ? 4200 : 0, ended: complete };
    if (!playing || clock.current.ended) return;
    let id = 0,
      last = 0;
    const tick = (time: number) => {
      if (last) clock.current.elapsed += Math.min(100, time - last) * speed * (reduced ? 42 : 1);
      last = time;
      const progress = Math.min(1, clock.current.elapsed / 4200);
      setFrame({ key: animationKey, progress });
      if (progress < 1) id = requestAnimationFrame(tick);
      else {
        clock.current.ended = true;
        callback.current();
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [animationKey, playing, speed, reduced, complete]);
  return frame.key === animationKey ? frame.progress : complete ? 1 : 0;
}
