'use client';
import type { GameState } from '@dugout/shared/types';
import { pitchingRole } from '@dugout/shared/pitching';
import type { MatchPlanDraft } from './use-match-plan';
import { PitchingInstructions } from './pitching-instructions';
import { MatchEnergyMeter } from './match-energy-meter';

export function MatchPitchingPlan({ g, draft }: { g: GameState; draft: MatchPlanDraft }) {
  const current = draft.byId.get(draft.plan.pitcher)!;
  const pitchers = draft.players.filter((p) => p.pos === 'P' && p.id !== current.id);
  const groups = [...new Set(pitchers.map((p) => pitchingRole(g, p)))];
  return (
    <section className="match-pitching-plan" aria-label="투수와 불펜 관리">
      <div className="pitching-plan-top">
        <article className="current-pitcher-card">
          <small>
            {draft.initial.pitcher !== current.id ? '교체 대기 · 적용 후 등판' : '현재 마운드'}
          </small>
          <h3>
            <span>#{current.number}</span> {current.name}
          </h3>
          <p>
            {pitchingRole(g, current)} · 구위 {Math.round(current.stuff)} · 제구{' '}
            {Math.round(current.control)}
          </p>
          <MatchEnergyMeter condition={current.condition} value={draft.energy.get(current.id)} />
          {(draft.energy.get(current.id) ?? current.condition) < 60 && (
            <p className="pitcher-fatigue-alert">
              체력이 떨어졌습니다. 승부 방침과 불펜 교체를 점검하세요.
            </p>
          )}
        </article>
        <PitchingInstructions
          value={draft.plan.instructions.pitching}
          onChange={(pitching) => draft.setInstructions({ ...draft.plan.instructions, pitching })}
        />
      </div>
      <div className="pitching-bullpen-heading">
        <h3>불펜 · 대기 투수</h3>
        <span>투수 선택 → 변경 확인 → 적용</span>
      </div>
      {!draft.canPitch && (
        <p className="plan-help">우리 팀 공격 중입니다. 투수 교체는 수비 타석 직전에 가능합니다.</p>
      )}
      {groups.map((group) => (
        <section className="pitching-role-group" key={group} aria-label={group}>
          <h4>{group}</h4>
          <div className="pitching-candidate-grid">
            {pitchers
              .filter((p) => pitchingRole(g, p) === group)
              .map((p) => {
                const reason = draft.unavailable(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    disabled={!!reason}
                    onClick={() => draft.assign('P', p.id)}
                    aria-label={`${p.name} 투수 교체 선택`}
                  >
                    <strong>
                      <span>#{p.number}</span> {p.name}
                    </strong>
                    <small>
                      구위 {Math.round(p.stuff)} · 제구 {Math.round(p.control)}
                    </small>
                    <MatchEnergyMeter
                      condition={p.condition}
                      value={draft.energy.get(p.id)}
                      compact
                    />
                    <span className="pitcher-candidate-action">
                      {reason || '마운드에 올리기 →'}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </section>
  );
}
