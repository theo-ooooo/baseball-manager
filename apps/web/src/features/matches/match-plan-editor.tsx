'use client';
import { useEffect, useState } from 'react';
import { Check, ClipboardList, SlidersHorizontal, Undo2 } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useMatchPlan } from './use-match-plan';
import { MatchBattingOrder, MatchBench, MatchDiamond } from './match-lineup-board';
import { MatchTacticsBoard } from './match-tactics-board';

export function MatchPlanEditor({
  g,
  cursor,
  busy,
  act,
  onApplied,
  onResume,
  onDirty,
  onCancel,
}: {
  g: GameState;
  cursor: number;
  busy: boolean;
  act: Act;
  onApplied: () => void;
  onResume: () => void;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
}) {
  const draft = useMatchPlan(g, cursor, busy);
  const [tab, setTab] = useState<'players' | 'tactics'>('players');
  const { plan, initial, dirty } = draft;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const substitutions = initial.lineup.flatMap((id, i) =>
    plan.lineup[i] !== id ? [{ from: id, to: plan.lineup[i], label: `${i + 1}번` }] : [],
  );
  if (initial.pitcher !== plan.pitcher)
    substitutions.push({ from: initial.pitcher, to: plan.pitcher, label: '투수' });
  const tacticChanged = JSON.stringify(initial.instructions) !== JSON.stringify(plan.instructions);
  return (
    <form
      className="match-preparation"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!dirty || busy) return;
        if (
          await act({
            type: 'reviseMatch',
            cursor,
            timelineVersion: g.liveMatch!.timelineVersion,
            ...plan,
          })
        )
          onApplied();
      }}
    >
      <div className="plan-toolbar">
        <div>
          <span className="plan-eyebrow">
            {cursor === 0 ? 'MATCHDAY · 경기 준비' : 'DUGOUT · 감독 지시'}
          </span>
          <h2>{cursor === 0 ? '승부는 여기서 시작됩니다' : '흐름을 바꿀 시간입니다'}</h2>
        </div>
        <div className="plan-tabs" aria-label="경기 계획 편집">
          <button type="button" aria-pressed={tab === 'players'} onClick={() => setTab('players')}>
            <ClipboardList size={16} />
            선수 구성
          </button>
          <button type="button" aria-pressed={tab === 'tactics'} onClick={() => setTab('tactics')}>
            <SlidersHorizontal size={16} />팀 전술
          </button>
        </div>
      </div>
      <fieldset disabled={busy} className="plan-workspace">
        <legend className="sr-only">경기 계획</legend>
        <div className="plan-board-layout">
          <MatchDiamond draft={draft} busy={busy} />
          {tab === 'players' ? (
            <MatchBattingOrder draft={draft} cursor={cursor} />
          ) : (
            <MatchTacticsBoard value={plan.instructions} onChange={draft.setInstructions} />
          )}
        </div>
        <div className="plan-interaction-hint" role="status" aria-live="polite">
          {draft.notice ||
            (draft.target !== null
              ? '교체할 선수를 선택했습니다. 아래에서 투입할 선수를 눌러 주세요.'
              : '구장 선수와 벤치 선수를 차례로 누르면 교체됩니다. 끌어서 놓기도 가능합니다.')}
          {(draft.target !== null || draft.incoming !== null) && (
            <button
              type="button"
              onClick={() => {
                if (draft.target !== null) draft.chooseSlot(draft.target);
                else if (draft.incoming) draft.chooseBench(draft.incoming);
              }}
            >
              선택 해제
            </button>
          )}
        </div>
        <MatchBench g={g} draft={draft} />
      </fieldset>
      <footer className="plan-footer">
        <div className="plan-review" aria-live="polite">
          <strong>{dirty ? '적용할 변경' : '경기 계획 준비 완료'}</strong>
          {dirty ? (
            <div className="plan-change-list">
              {substitutions.map((s) => (
                <span key={s.label}>
                  <b>{s.label}</b> {draft.byId.get(s.from)?.name} → {draft.byId.get(s.to)?.name}
                </span>
              ))}
              {tacticChanged && <span>팀 전술 변경</span>}
            </div>
          ) : (
            <small>
              {cursor === 0
                ? '준비를 마치고 플레이볼을 눌러 주세요.'
                : '변경은 다음 타석부터 적용됩니다.'}
            </small>
          )}
        </div>
        <div className="plan-actions">
          <button
            type="button"
            className="button secondary compact"
            disabled={busy || !draft.canUndo}
            onClick={draft.restore}
          >
            <Undo2 size={15} />
            되돌리기
          </button>
          <button
            type="button"
            className="button secondary compact"
            disabled={busy}
            onClick={onCancel}
          >
            {dirty ? '변경 취소' : '경기 화면'}
          </button>
          {dirty ? (
            <button type="submit" className="button primary compact" disabled={busy}>
              <Check size={16} />
              {busy
                ? '경기 계획 반영 중…'
                : cursor === 0
                  ? '경기 계획 적용'
                  : '변경 적용 · 이후 경기 갱신'}
            </button>
          ) : (
            <button
              type="button"
              className="button primary compact"
              disabled={busy}
              onClick={onResume}
            >
              <Check size={16} />
              {cursor === 0 ? '준비 완료 · 플레이볼' : '경기 계속'}
            </button>
          )}
        </div>
      </footer>
    </form>
  );
}
