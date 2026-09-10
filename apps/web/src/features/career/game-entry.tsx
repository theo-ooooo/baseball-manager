'use client';
import dynamic from 'next/dynamic';

// Career data already loads from authenticated APIs in the browser. Avoid initializing the
// entire interactive game tree in Workers merely to render its initial loading screen.
const GameEntry = dynamic(() => import('./game'), {
  ssr: false,
  loading: ({ error, retry }) => (
    <main className="catalog-loading" aria-live="polite">
      <div className="brand">
        <span aria-hidden="true">◉</span>
        <span>
          DUGOUT<i>WORLD BASEBALL MANAGER</i>
        </span>
      </div>
      <h1>{error ? '화면을 불러오지 못했습니다' : '커리어 불러오는 중'}</h1>
      <p>
        {error ? '잠시 후 다시 시도해 주세요.' : '리그, 선수단, 저장된 커리어를 불러오는 중입니다.'}
      </p>
      {error && (
        <button className="button primary" onClick={retry}>
          다시 시도
        </button>
      )}
    </main>
  ),
});
export default GameEntry;
