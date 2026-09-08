'use client';
import type { GameState, Player } from '../../packages/shared/src/types';
import { firstTeam } from '../../packages/shared/src/management';
import { ratingText } from '../../packages/shared/src/ratings';

type Props = {
  g: GameState;
  busy: boolean;
  act: (a: Record<string, unknown>) => Promise<GameState | null>;
  onPlayer: (p: Player) => void;
};
export function PitchingPanel({ g, busy, act, onPlayer }: Props) {
  const plan = g.pitching;
  if (!plan) return null;
  return (
    <section className="panel training-block pitching-panel">
      <div className="panel-header">
        <h2>투수 운용</h2>
        <span>선발 로테이션 · 불펜 · 마무리</span>
      </div>
      <div className="pitching-groups">
        {[
          { title: '선발 로테이션', ids: plan.rotation },
          { title: '불펜', ids: plan.bullpen },
          { title: '마무리', ids: plan.closer ? [plan.closer] : [] },
        ].map((group) => (
          <div key={group.title}>
            <h3>{group.title}</h3>
            {group.ids.map((id) => {
              const p = firstTeam(g).find((p) => p.id === id);
              if (!p) return null;
              const at = plan.rotation.indexOf(id);
              return (
                <div className="pitcher-row" key={id}>
                  <button className="text-button" onClick={() => onPlayer(p)}>
                    <strong>{p.name}</strong>
                    {g.starter === id && <small>다음 경기 선발</small>}
                  </button>
                  <small>
                    능력 {ratingText(p)} · 체력 {Math.round(p.condition)}%
                  </small>
                  <label className="sr-only" htmlFor={`role-${id}`}>
                    {p.name} 보직
                  </label>
                  <select
                    id={`role-${id}`}
                    disabled={busy}
                    value={at >= 0 ? 'starter' : plan.closer === id ? 'closer' : 'bullpen'}
                    onChange={(e) => void act({ type: 'pitchingRole', id, role: e.target.value })}
                  >
                    <option value="starter">선발</option>
                    <option value="bullpen">불펜</option>
                    <option value="closer">마무리</option>
                  </select>
                  {at >= 0 && (
                    <button
                      className="text-button"
                      disabled={busy || at === 0}
                      aria-label={`${p.name} 로테이션 순서 올리기`}
                      onClick={() => {
                        const ids = [...plan.rotation];
                        [ids[at - 1], ids[at]] = [ids[at], ids[at - 1]];
                        void act({ type: 'rotationOrder', ids });
                      }}
                    >
                      ↑
                    </button>
                  )}
                </div>
              );
            })}
            {!group.ids.length && <p className="tiny">지정된 투수가 없습니다.</p>}
          </div>
        ))}
      </div>
      <p className="panel-content tiny">
        선발은 지정한 순서와 회복 상태에 따라 등판합니다. 경기 중 투구 이닝·실점·체력에 따라 불펜이
        투입되고, 9회 이후 1~3점 리드에서는 마무리를 우선 기용합니다. 처음 보직은 확인된
        이닝·등판·세이브 기록을 참고한 게임 추천입니다.
      </p>
    </section>
  );
}
