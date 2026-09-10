'use client';
// 3D stadium renderer. `three` is imported lazily inside an effect so it only loads when this
// component mounts. Props are mirrored into refs; every frame the parent advances `progress`
// and we redraw the existing scene — nothing is rebuilt and React does not re-render per frame.
import { useEffect, useRef } from 'react';
import type { replayScene } from '@dugout/shared/replay';
import type { StadiumController } from './stadium-3d-scene';

export type Stadium3DProps = {
  scene: ReturnType<typeof replayScene>;
  /** 0..1 play progress (the parent already handles reduced motion by jumping to 1). */
  progress: number;
  attackColor: string;
  defendColor: string;
  /** Called when WebGL is unavailable or the context is lost for good — parent falls back to 2D. */
  onUnavailable?: () => void;
  camera?: 'overview' | 'broadcast';
  className?: string;
};

function canUseWebGL() {
  return typeof WebGL2RenderingContext !== 'undefined';
}

export function Stadium3D({
  scene,
  progress,
  attackColor,
  defendColor,
  onUnavailable,
  camera = 'broadcast',
  className,
}: Stadium3DProps) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<StadiumController | null>(null);
  const unavailable = useRef(onUnavailable);
  const latest = useRef({ scene, progress, attackColor, defendColor, camera });
  useEffect(() => {
    latest.current = { scene, progress, attackColor, defendColor, camera };
  }, [scene, progress, attackColor, defendColor, camera]);
  useEffect(() => {
    unavailable.current = onUnavailable;
  }, [onUnavailable]);

  // Mount: load three, build the stadium once, wire resize + context loss, tear down on unmount.
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    if (!canUseWebGL()) {
      unavailable.current?.();
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'stadium-3d-canvas';
    host.prepend(canvas);
    let cancelled = false,
      lostTimer = 0,
      observer: ResizeObserver | null = null;
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
    import('./stadium-3d-scene')
      .then(({ createStadium }) => {
        if (cancelled) return;
        let stadium: StadiumController;
        try {
          stadium = createStadium(canvas, {
            mobile,
            onLost: () => {
              host.dataset.state = 'lost';
              // Give the browser a moment to restore; otherwise hand back to the 2D view.
              lostTimer = window.setTimeout(() => unavailable.current?.(), 2500);
            },
            onRestored: () => {
              window.clearTimeout(lostTimer);
              host.dataset.state = 'ready';
            },
          });
        } catch {
          unavailable.current?.();
          return;
        }
        controller.current = stadium;
        const { scene, attackColor, defendColor, camera, progress } = latest.current;
        stadium.setReplay(scene, attackColor, defendColor);
        stadium.setCamera(camera);
        stadium.setProgress(progress);
        const fit = () => {
          const rect = host.getBoundingClientRect();
          stadium.resize(Math.round(rect.width), Math.round(rect.height));
          stadium.requestRender();
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(host);
        host.dataset.state = 'ready';
      })
      .catch(() => {
        if (!cancelled) unavailable.current?.();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(lostTimer);
      observer?.disconnect();
      controller.current?.dispose();
      controller.current = null;
      canvas.remove();
    };
  }, []);

  // Play change: swap actors/colours on the existing scene graph.
  useEffect(() => {
    const stadium = controller.current;
    if (!stadium) return;
    stadium.setReplay(scene, attackColor, defendColor);
    stadium.requestRender();
  }, [scene, attackColor, defendColor]);

  useEffect(() => {
    const stadium = controller.current;
    if (!stadium) return;
    stadium.setCamera(camera);
    stadium.requestRender();
  }, [camera]);

  // Per-frame: only the progress scalar changes; draw once per animation frame.
  useEffect(() => {
    const stadium = controller.current;
    if (!stadium) return;
    stadium.setProgress(progress);
    stadium.requestRender();
  }, [progress]);

  return (
    <div
      ref={container}
      className={['stadium-3d', className].filter(Boolean).join(' ')}
      data-state="loading"
      role="img"
      aria-label={`3D 야구장 ${scene.event?.inning || 1}회 ${scene.event?.half ? '말' : '초'} 플레이 진행`}
    >
      <div className="stadium-3d-status" aria-hidden="true">
        <span className="stadium-3d-status-loading">3D 경기장 준비 중…</span>
        <span className="stadium-3d-status-lost">그래픽 컨텍스트 복구 중…</span>
      </div>
    </div>
  );
}

export default Stadium3D;
