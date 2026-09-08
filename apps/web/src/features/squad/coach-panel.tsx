'use client';
import { useState } from 'react';
import type { Coach, GameState } from '@dugout/shared/types';
import { coachRoles, money } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { CoachNegotiations, CoachOfferDialog } from './coach-negotiations';
export function CoachPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { coachPool, getClub } = useWorld();
  const [role, setRole] = useState('타격'),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('real'),
    [page, setPage] = useState(0),
    [offering, setOffering] = useState<Coach | null>(null);
  const candidates = coachPool(g.year).filter(
    (c) =>
      (c.real || c.role === role) &&
      (kind === 'all' || (kind === 'real' ? c.real : !c.real)) &&
      `${c.name} ${getClub(c.sourceClub || '')?.name || ''}`.includes(query),
  );
  const pages = Math.max(1, Math.ceil(candidates.length / 12)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>코칭 스태프</h2>
          <span>게임 내 담당 보직</span>
        </div>
        <div className="staff-summary">
          {coachRoles.map((role) => {
            const c = g.staff.find((c) => c.role === role);
            return (
              <div key={role}>
                <small>{role} 코치</small>
                <strong>{c?.name || '공석'}</strong>
                <span>
                  {c?.real ? '실명' : '가상'} · 능력 {c?.skill || 35}
                </span>
                <small>
                  연봉 {money(c?.salary || 0)}
                  {c?.contractUntil ? ` · ${c.contractUntil - g.year}시즌 계약` : ''}
                </small>
                {c?.real && (
                  <a href={c.source} target="_blank" rel="noreferrer">
                    등록 소속: {getClub(c.sourceClub || '')?.name} ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <CoachNegotiations g={g} act={act} busy={busy} onOffer={setOffering} />
      {offering && (
        <CoachOfferDialog
          key={offering.id}
          coach={offering}
          role={role}
          g={g}
          act={act}
          busy={busy}
          close={() => setOffering(null)}
        />
      )}
      <section className="panel training-block">
        <div className="panel-header">
          <h2>코치 후보</h2>
          <span>조건 제안 후 답변을 기다립니다</span>
        </div>
        <div className="coach-filters">
          <label>
            선임할 보직
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(0);
              }}
            >
              {coachRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            코치 구분
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
              }}
            >
              <option value="real">실명 코치</option>
              <option value="generated">가상 코치</option>
              <option value="all">전체 코치</option>
            </select>
          </label>
          <input
            aria-label="코치 이름 또는 소속 검색"
            placeholder="이름 또는 등록 소속 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>코치</th>
                <th>공식 등록 소속</th>
                <th>능력</th>
                <th>연봉</th>
                <th>선임</th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(current * 12, current * 12 + 12).map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small>
                      {c.real ? '실명' : '가상'} · {c.real ? c.verifiedRole : c.style}
                    </small>
                  </td>
                  <td>
                    {c.source ? (
                      <a href={c.source} target="_blank" rel="noreferrer">
                        {getClub(c.sourceClub || '')?.name} ↗
                      </a>
                    ) : (
                      '가상 후보'
                    )}
                  </td>
                  <td>{c.skill}</td>
                  <td>{money(c.salary)}</td>
                  <td>
                    <button
                      className="button secondary compact"
                      disabled={busy || g.staff.some((s) => s.id === c.id)}
                      onClick={() => setOffering(c)}
                    >
                      {g.staff.some((s) => s.id === c.id) ? '선임됨' : `${role} 계약 제안`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{candidates.length}명</span>
          <div>
            <button
              aria-label="이전 코치 목록"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              ←
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              aria-label="다음 코치 목록"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              →
            </button>
          </div>
        </div>
        <p className="panel-content tiny">
          실명 코치는 KBO 2026년 9월 7일 등록 명단 기준입니다. 이름·등록 소속·코치 신분은 공식
          자료이며, 능력·연봉·게임 담당 보직은 게임 설정입니다. 선임하면 선택한 보직의 기존 코치가
          교체됩니다.
        </p>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>팀 훈련</h2>
          <span>1군·2군 모두 적용</span>
        </div>
        <div className="preset-buttons training-presets">
          {Object.entries({
            balanced: '균형 훈련',
            power: '장타 훈련',
            pitching: '투구 훈련',
            defense: '수비 훈련',
            rest: '회복',
          }).map(([value, label]) => (
            <button
              key={value}
              className={g.training === value ? 'selected' : ''}
              disabled={busy}
              onClick={() => void act({ type: 'training', value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="panel-content tiny">
          타격·투수 코치는 해당 능력 성장, 수비 코치는 수비와 포지션 숙련도, 체력 코치는 회복,
          스카우트는 잠재력 평가에 영향을 줍니다.
        </p>
      </section>
    </>
  );
}
