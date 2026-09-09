'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { firstTeam } from '@dugout/shared/management';
import { lineupAuto } from '@dugout/shared/game-view';
import { lineupReason } from '@dugout/shared/player-attributes';
import { ratingText } from '@dugout/shared/ratings';

export function BattingOrderEditor({
  g,
  act,
  busy,
  onPlayer,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
}) {
  const [lineup, setLineup] = useState([...g.lineup]);
  const dirty = lineup.join(':') !== g.lineup.join(':');
  const active = firstTeam(g),
    byId = new Map(active.map((p) => [p.id, p]));
  const batters = lineup.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  function changeBatter(index: number, id: string) {
    const ids = [...lineup],
      old = ids.indexOf(id);
    if (old >= 0) [ids[index], ids[old]] = [ids[old], ids[index]];
    else ids[index] = id;
    setLineup(ids);
  }
  return (
    <section className="panel" data-unsaved-plan={dirty || undefined}>
      <div className="panel-header">
        <h2>선발 타순</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setLineup(lineupAuto(active))}
        >
          코치 추천
        </button>
      </div>
      <div className="management-lineup">
        {batters.map((p, i) => (
          <div key={p.id}>
            <b>{i + 1}</b>
            <div>
              <select
                aria-label={`${i + 1}번 타자`}
                value={p.id}
                disabled={busy}
                onChange={(e) => changeBatter(i, e.target.value)}
              >
                {active
                  .filter((v) => v.pos !== 'P')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.pos}
                    </option>
                  ))}
              </select>
              <button className="text-button" onClick={() => onPlayer(p)}>
                능력 {ratingText(p)} · 컨디션 {Math.round(p.condition)}%
              </button>
              <small className="lineup-reason">{lineupReason(p, i)}</small>
            </div>
            <div className="lineup-arrows">
              <button
                aria-label={`${p.name} 타순 올리기`}
                disabled={busy || i === 0}
                onClick={() => changeBatter(i, lineup[i - 1])}
              >
                ↑
              </button>
              <button
                aria-label={`${p.name} 타순 내리기`}
                disabled={busy || i === 8}
                onClick={() => changeBatter(i, lineup[i + 1])}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="lineup-draft-actions" role="status">
        <span>{dirty ? '변경한 타순 · 아직 저장하지 않음' : '저장된 타순'}</span>
        <div>
          <button
            className="button secondary compact"
            disabled={busy || !dirty}
            onClick={() => setLineup([...g.lineup])}
          >
            되돌리기
          </button>
          <button
            className="button primary compact"
            disabled={busy || !dirty || batters.length !== 9}
            onClick={() => void act({ type: 'lineup', ids: lineup })}
          >
            {busy ? '타순 저장 중…' : '타순 적용'}
          </button>
        </div>
      </div>
      <div className="panel-content tiny">
        타순을 바꿔도 기존 선수의 수비 위치는 유지됩니다. 벤치 선수와 교체하면 수비 배치를 다시
        확인하세요.
      </div>
    </section>
  );
}
