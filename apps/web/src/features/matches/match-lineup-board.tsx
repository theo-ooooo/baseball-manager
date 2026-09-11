'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { DefensivePosition, Player } from '@dugout/shared/types';
import { familiarity, positionLabels } from '@dugout/shared/management';
import { ratingText } from '@dugout/shared/ratings';
import type { MatchPlanDraft, PlanSlot } from './use-match-plan';

const positions: { pos: DefensivePosition; x: number; y: number }[] = [
  { pos: 'LF', x: 18, y: 24 },
  { pos: 'CF', x: 50, y: 15 },
  { pos: 'RF', x: 82, y: 24 },
  { pos: 'SS', x: 33, y: 43 },
  { pos: '2B', x: 67, y: 43 },
  { pos: '3B', x: 16, y: 62 },
  { pos: '1B', x: 84, y: 62 },
  { pos: 'P', x: 50, y: 63 },
  { pos: 'C', x: 50, y: 85 },
  { pos: 'DH', x: 16, y: 87 },
];
function Condition({ player, energy }: { player: Player; energy?: number }) {
  const value = Math.max(0, Math.min(100, Math.round(energy ?? player.condition)));
  return (
    <span
      className={`plan-condition ${value < 65 ? 'is-tired' : ''}`}
      title={`${energy === undefined ? '컨디션' : '경기 체력'} ${value}%`}
    >
      <i style={{ width: `${value}%` }} />
    </span>
  );
}
export function MatchDiamond({ draft, busy }: { draft: MatchPlanDraft; busy: boolean }) {
  return (
    <section className="plan-field" aria-label="수비 배치와 선수 교체">
      <div className="plan-field-heading">
        <span>수비 배치</span>
        <small>선수 선택 → 벤치에서 교체</small>
      </div>
      <svg className="plan-field-lines" viewBox="0 0 500 500" aria-hidden="true">
        <path className="plan-outfield" d="M250 449 24 219 Q250 -45 476 219Z" />
        <path className="plan-infield" d="m250 408-123-123 123-123 123 123Z" />
        <path d="M250 449 24 219M250 449 476 219M250 408 127 285 250 162 373 285Z" />
        <circle cx="250" cy="304" r="19" />
        <path d="M244 408h12v8l-6 5-6-5Z" />
      </svg>
      {positions
        .filter((p) => p.pos !== 'P')
        .map(({ pos, x, y }) => {
          const p = draft.byId.get(draft.defense[pos]);
          if (!p) return null;
          const slot: PlanSlot = pos === 'P' ? 'P' : draft.plan.lineup.indexOf(p.id);
          const selected = draft.target === slot;
          const shiftedY = ['LF', 'CF', 'RF'].includes(pos)
            ? y - (draft.plan.instructions.depth - 50) * 0.07
            : y;
          return (
            <button
              type="button"
              className="plan-fielder"
              key={pos}
              style={{ left: `${x}%`, top: `${shiftedY}%` }}
              aria-label={`${positionLabels[pos]} ${p.name} 교체 선택`}
              aria-pressed={selected}
              disabled={busy || (pos === 'P' && !draft.canPitch)}
              onClick={() => draft.chooseSlot(slot)}
              onDragOver={(e) => {
                if (!busy) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) draft.assign(slot, e.dataTransfer.getData('text/plain'));
              }}
            >
              <span className="plan-position">{slot === 'P' ? 'P' : `${slot + 1} · ${pos}`}</span>
              <strong>{p.name}</strong>
              <Condition player={p} energy={draft.energy.get(p.id)} />
              {pos !== 'P' && pos !== 'DH' && familiarity(p, pos) < 50 && (
                <small className="plan-fit-warning">낯선 포지션</small>
              )}
            </button>
          );
        })}
    </section>
  );
}
export function MatchBattingOrder({ draft, cursor }: { draft: MatchPlanDraft; cursor: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="plan-batting" aria-label="타순표" data-expanded={expanded}>
      <div className="plan-section-heading">
        <h3>선발 타순</h3>
        <button
          className="plan-order-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '접기' : '타순 9명 보기'}
        </button>
        <small>{cursor === 0 ? '끌어서 타순 교환' : '선택 후 벤치 투입'}</small>
      </div>
      <ol>
        {draft.plan.lineup.map((id, slot) => {
          const p = draft.byId.get(id)!;
          const pos = Object.entries(draft.defense).find(([, player]) => player === id)?.[0];
          return (
            <li
              key={slot}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                draft.assign(slot, e.dataTransfer.getData('text/plain'), true);
              }}
            >
              <button
                className="plan-batter"
                type="button"
                draggable={cursor === 0}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                aria-label={`${slot + 1}번 ${p.name} 교체 선택`}
                aria-pressed={draft.target === slot}
                onClick={() => draft.chooseSlot(slot)}
              >
                <span className="plan-order-number">{slot + 1}</span>
                <span className="plan-batter-name">
                  <strong>{p.name}</strong>
                  <small>
                    {pos} · {draft.energy.has(p.id) ? '체력' : '컨디션'}{' '}
                    {Math.round(draft.energy.get(p.id) ?? p.condition)}%
                  </small>
                </span>
                <span className="plan-rating" title="종합 능력">
                  {ratingText(p)}
                </span>
                {cursor === 0 && <GripVertical size={13} aria-hidden="true" />}
              </button>
              {cursor === 0 && (
                <span className="plan-order-arrows">
                  <button
                    type="button"
                    aria-label={`${p.name} 타순 올리기`}
                    disabled={slot === 0}
                    onClick={() => draft.assign(slot - 1, id, true)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${p.name} 타순 내리기`}
                    disabled={slot === 8}
                    onClick={() => draft.assign(slot + 1, id, true)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export function MatchBench({ draft }: { draft: MatchPlanDraft }) {
  const candidates = draft.players.filter(
    (p) => p.pos !== 'P' && !draft.plan.lineup.includes(p.id),
  );
  const outgoingId =
    draft.target === 'P'
      ? draft.plan.pitcher
      : draft.target !== null
        ? draft.plan.lineup[draft.target]
        : null;
  return (
    <section className="plan-bench" aria-label="야수 벤치">
      <div className="plan-section-heading">
        <h3>야수 벤치 · 대타 / 대수비</h3>
        <small>
          {outgoingId
            ? `${draft.byId.get(outgoingId)?.name} 대신 투입할 선수`
            : '선수 카드를 구장으로 끌어 놓으세요'}
        </small>
      </div>
      <div className="plan-bench-grid">
        {candidates.map((p) => {
          const reason = draft.unavailable(p.id);
          return (
            <button
              type="button"
              className="plan-reserve"
              key={p.id}
              disabled={!!reason}
              title={reason || `${p.name} 선택 또는 끌어서 교체`}
              aria-label={`${p.name} 투입 선택${reason ? ` · ${reason}` : ''}`}
              aria-pressed={draft.incoming === p.id}
              draggable={!reason}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', p.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => draft.chooseBench(p.id)}
            >
              <span className="plan-shirt">{p.number ?? '·'}</span>
              <span className="plan-reserve-info">
                <strong>{p.name}</strong>
                <small>
                  {p.pos} · {draft.energy.has(p.id) ? '체력' : '컨디션'}{' '}
                  {Math.round(draft.energy.get(p.id) ?? p.condition)}%
                </small>
                <Condition player={p} energy={draft.energy.get(p.id)} />
                {reason && <small>{reason}</small>}
              </span>
              <span className="plan-rating" title="종합 능력">
                {ratingText(p)}
              </span>
            </button>
          );
        })}
      </div>
      {!candidates.length && <p className="plan-help">투입할 수 있는 1군 선수가 없습니다.</p>}
      {!draft.canPitch && (
        <p className="plan-help">투수 교체는 우리 팀 수비 타석 직전에 가능합니다.</p>
      )}
    </section>
  );
}
