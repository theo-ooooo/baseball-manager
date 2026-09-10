'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import { gameDate } from '@dugout/shared/calendar';
import { isUnemployed } from '@dugout/shared/manager-career';
import type { Act } from '../career/game-contracts';
export function MedicalDecision({
  g,
  player: p,
  act,
  busy,
}: {
  g: GameState;
  player: Player;
  act: Act;
  busy: boolean;
}) {
  const [early, setEarly] = useState(false),
    injury = p.injury;
  if (!injury)
    return (
      <div className="medical-decision">
        <strong>복귀 승인 · 현재 치료가 끝난 선수입니다.</strong>
      </div>
    );
  const disabled = busy || !!g.liveMatch || isUnemployed(g),
    canEarly = gameDate(g) >= injury.earliestReturn && injury.phase !== 'earlyReturn';
  return (
    <section className="medical-decision">
      <div className="medical-decision-heading">
        <strong>
          {p.name} ·{' '}
          {
            { treatment: '치료 중', rehab: '재활 진행 중', earlyReturn: '조기 복귀 승인' }[
              injury.phase
            ]
          }
        </strong>
        <span>복귀 예정 {injury.returnDate}</span>
      </div>
      <p>
        조기 복귀 검토일 {injury.earliestReturn} · 재발 위험 {injury.recurrenceRisk}%/주
      </p>
      <div className="medical-decision-actions">
        <button
          className="button primary"
          disabled={disabled || injury.phase === 'rehab'}
          onClick={() => void act({ type: 'rehabPlayer', id: p.id })}
        >
          {injury.phase === 'rehab' ? '재활 프로그램 진행 중' : '재활 진행 · 회복에 집중'}
        </button>
        {canEarly && (
          <button className="button secondary" disabled={disabled} onClick={() => setEarly(true)}>
            조기 복귀 검토
          </button>
        )}
      </div>
      {early && canEarly && (
        <div className="medical-early-confirm">
          <strong>완전히 회복되기 전에 출전시키겠습니까?</strong>
          <p>
            {injury.returnDate}까지 주당 {injury.recurrenceRisk}%의 재발 위험이 적용됩니다. 재발하면
            복귀가 늦어질 수 있습니다.
          </p>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={async () => {
              if (await act({ type: 'earlyReturnPlayer', id: p.id, confirm: true }))
                setEarly(false);
            }}
          >
            위험을 감수하고 복귀 승인
          </button>
          <button className="text-button" disabled={busy} onClick={() => setEarly(false)}>
            회복을 기다리겠습니다
          </button>
        </div>
      )}
      {g.liveMatch && <p>진행 중인 경기를 마친 뒤 의무팀에 지시할 수 있습니다.</p>}
    </section>
  );
}
