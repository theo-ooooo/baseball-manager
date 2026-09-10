'use client';
import { useStadium3D, type Stadium3DProps } from './use-stadium-3d';

export type { Stadium3DProps } from './use-stadium-3d';

export function Stadium3D(props: Stadium3DProps) {
  const container = useStadium3D(props);
  const { scene, className } = props;
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
