'use client';
import { ArrowUp, ArrowDown, RotateCcw, WandSparkles } from 'lucide-react';
import { useBattingOrder } from './use-lineup-editor';
import type { GameState, Player } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
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
  const { lineup, active, batters, dirty, changeBatter, recommend, reset } = useBattingOrder(g);
  return (
    <section className="panel lineup-order-panel" data-unsaved-plan={dirty || undefined}>
      <div className="panel-header">
        <div>
          <span className="lineup-eyebrow">BATTING ORDER</span>
          <h2>
            선발 타순 <small>{batters.length} / 9</small>
          </h2>
        </div>
        <button className="text-button" disabled={busy} onClick={recommend}>
          <WandSparkles size={14} /> 코치 추천
        </button>
      </div>
      <div className="lineup-column-labels">
        <span>타순</span>
        <span>선수 · 컨디션</span>
        <span>순서 변경</span>
      </div>
      <div className="management-lineup">
        {batters.map((p, i) => (
          <div key={p.id} title={lineupReason(p, i)}>
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
              <button
                className="lineup-player-detail"
                aria-label={`${p.name} 선수 상세`}
                onClick={() => onPlayer(p)}
              >
                능력 {ratingText(p)} · 컨디션 {Math.round(p.condition)}%
              </button>
            </div>
            <div className="lineup-arrows">
              <button
                aria-label={`${p.name} 타순 올리기`}
                disabled={busy || i === 0}
                onClick={() => changeBatter(i, lineup[i - 1])}
              >
                <ArrowUp size={15} />
              </button>
              <button
                aria-label={`${p.name} 타순 내리기`}
                disabled={busy || i === 8}
                onClick={() => changeBatter(i, lineup[i + 1])}
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="lineup-draft-actions" role="status">
        <span>{dirty ? '수정한 타순 · 적용 필요' : '현재 적용 중'}</span>
        <div>
          <button className="button secondary compact" disabled={busy || !dirty} onClick={reset}>
            <RotateCcw size={14} /> 되돌리기
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
      <details className="lineup-selection-notes">
        <summary>타순별 기용 이유 · 배치 안내</summary>
        <ol>
          {batters.map((p, i) => (
            <li key={p.id}>
              <b>{p.name}</b> {lineupReason(p, i)}
            </li>
          ))}
        </ol>
        <p>순서를 바꾸면 수비 위치는 유지됩니다. 선수를 교체한 뒤에는 수비 배치를 확인하세요.</p>
      </details>
    </section>
  );
}
