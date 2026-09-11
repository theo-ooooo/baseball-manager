'use client';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import {
  coachRoles,
  coachingRoles,
  coachRoleLabel,
  coachRoleDetails,
  money,
} from '@dugout/shared/game-view';
import { useCoachDirectory } from './use-coach-directory';
import { coachJudgment } from '@dugout/shared/coach-assessment';
import type { Act } from '../career/game-contracts';
import { CoachNegotiations, CoachOfferDialog } from './coach-negotiations';
export function CoachPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const directory = useCoachDirectory(g);
  const { group, role, query, kind, offering, rows, pages, current, setOffering } = directory;
  return (
    <div className="coach-center">
      <nav className="coach-affiliation-tabs" aria-label="코치 소속 구분">
        {[
          ['own', '우리 팀'],
          ['other', '타 구단'],
          ['free', '무소속'],
        ].map(([key, label]) => (
          <button key={key} aria-pressed={group === key} onClick={() => directory.setGroup(key)}>
            {label}
            <b>{directory.counts[key]}</b>
          </button>
        ))}
      </nav>
      {group === 'own' && (
        <section className="panel">
          <div className="panel-header">
            <h2>{directory.clubName(g.club)} · 담당 코치진</h2>
            <span>현재 우리 팀에서 지도하는 코치</span>
          </div>
          {[
            { title: '코칭 보직', roles: coachingRoles },
            { title: '선수 관찰 스태프', roles: ['스카우트'] },
          ].map((section) => (
            <div className="staff-role-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="staff-summary">
                {section.roles.map((role) => {
                  const c = g.staff.find((c) => c.role === role);
                  return (
                    <div key={role} className={c ? '' : 'staff-vacancy'}>
                      <small>{coachRoleLabel(role)}</small>
                      <strong>
                        {c ? (
                          <Link href={`/coaches/${encodeURIComponent(c.id)}`}>{c.name}</Link>
                        ) : (
                          '공석'
                        )}
                      </strong>
                      <span>
                        {c
                          ? `능력 ${c.skill} · ${coachJudgment(c).label}`
                          : '새 담당자를 선임할 수 있습니다'}
                      </span>
                      {c && (
                        <small>
                          연봉 {money(c.salary)}
                          {c.contractUntil ? ` · ${c.contractUntil - g.year}시즌 계약` : ''}
                        </small>
                      )}
                      <small>{coachRoleDetails[role]}</small>
                      {!c && (
                        <button
                          className="text-button"
                          onClick={() => {
                            directory.setRole(role);
                            directory.setGroup('free');
                          }}
                        >
                          영입 후보 보기 →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="panel-content tiny">
            코치 능력이 높을수록 교체 후보 평가 오차가 줄고 피로를 일찍 파악합니다. 추천은 코치의
            판단이며 경기 결과를 보장하지 않습니다.
          </p>
        </section>
      )}
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
          <h2>
            {group === 'own'
              ? '우리 팀 소속 코치'
              : group === 'other'
                ? '타 구단 코치'
                : '무소속 코치'}
          </h2>
          <span>
            {group === 'own'
              ? '현재 담당 보직과 계약'
              : group === 'other'
                ? '현재 소속 확인 후 영입 조건 제안'
                : '새 구단을 찾는 코치'}
          </span>
        </div>
        <div className="coach-filters">
          <label>
            선임할 보직
            <select
              value={role}
              onChange={(e) => {
                directory.setRole(e.target.value);
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
                directory.setKind(e.target.value);
              }}
            >
              <option value="real">실명 코치</option>
              <option value="generated">가상 코치</option>
              <option value="all">전체 코치</option>
            </select>
          </label>
          <input
            aria-label="코치 이름 또는 소속 검색"
            placeholder="코치 이름 · 현재 구단 검색"
            value={query}
            onChange={(e) => {
              directory.setQuery(e.target.value);
            }}
          />
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>코치</th>
                <th>현재 소속 · 계약</th>
                <th>능력</th>
                <th>연봉</th>
                <th>선임</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ coach: c, club, assigned }) => (
                <tr key={c.id}>
                  <td>
                    <strong>
                      <Link href={`/coaches/${encodeURIComponent(c.id)}`}>{c.name}</Link>
                    </strong>
                    <small>
                      {c.real ? '실명' : '가상'} · {c.real ? c.verifiedRole : c.style}
                    </small>
                  </td>
                  <td>
                    <strong className={`coach-employer ${group}`}>
                      {directory.clubName(club)}
                    </strong>
                    <small>
                      {assigned ? `${c.role} 담당` : club === 'fa' ? '계약 없음' : '구단 소속'}
                    </small>
                    {c.contractUntil && club !== 'fa' && (
                      <small>{c.contractUntil}시즌 전까지 계약</small>
                    )}
                    {c.source && (
                      <a className="coach-source" href={c.source} target="_blank" rel="noreferrer">
                        원본 등록 자료 ↗
                      </a>
                    )}
                  </td>
                  <td data-label="능력">{c.skill}</td>
                  <td data-label="연봉">{money(c.salary)}</td>
                  <td>
                    <button
                      className="button secondary compact"
                      disabled={busy || assigned}
                      onClick={() => setOffering(c)}
                    >
                      {assigned
                        ? '우리 팀 담당 코치'
                        : group === 'other'
                          ? '영입 조건 제안'
                          : group === 'own'
                            ? '담당 보직 제안'
                            : `${role} 계약 제안`}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="coach-empty">
                    조건에 맞는 코치가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{directory.count}명</span>
          <div>
            <button
              aria-label="이전 코치 목록"
              disabled={current === 0}
              onClick={() => directory.setPage(current - 1)}
            >
              ←
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              aria-label="다음 코치 목록"
              disabled={current + 1 >= pages}
              onClick={() => directory.setPage(current + 1)}
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
          <Link className="text-button" href="/?view=training">
            훈련 센터로 →
          </Link>
        </div>
        <p className="panel-content tiny">
          선수단의 훈련 탭에서 주간 일정, 개인 강도, 코치 담당과 컨디션별 휴식을 함께 관리합니다.
        </p>
      </section>
    </div>
  );
}
