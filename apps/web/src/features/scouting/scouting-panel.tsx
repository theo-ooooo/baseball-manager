'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Binoculars } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import { scoutingCost, scoutingDurations } from '@dugout/shared/scouting';
import { money } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { ScoutReportCard, ScoutComparison } from './scout-report';

export function ScoutingPanel({
  g,
  act,
  busy,
  onPlayer,
  onNegotiate,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onNegotiate: (p: Player) => void;
}) {
  const { leagues, marketPlayers, getClub } = useWorld();
  const [tab, setTab] = useState(g.scouting?.reports.length ? 'reports' : 'missions'),
    [league, setLeague] = useState(getClub(g.club).league),
    [pos, setPos] = useState('all'),
    [maxAge, setMaxAge] = useState(25),
    [days, setDays] = useState(14),
    [selected, setSelected] = useState<string[]>([]);
  const market = useMemo(() => new Map(marketPlayers(g).map((p) => [p.id, p])), [g, marketPlayers]);
  const s = g.scouting,
    active = s?.assignments.filter((t) => t.status === 'active') || [],
    scout = g.staff.find((c) => c.role === '스카우트');
  const reports = s?.reports || [],
    cost = scoutingCost(days, true);
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 3 ? [...ids, id] : ids,
    );
  return (
    <div className="scouting-center">
      <header className="market-notice">
        <Binoculars size={26} />
        <div>
          <strong>스카우팅 센터</strong>
          <p>관찰 의뢰 → 날짜 진행 → 보고 검토 → 비교 · 영입 협상</p>
        </div>
        <div>
          <small>파견 중</small>
          <strong>{active.length} / 3</strong>
        </div>
      </header>
      <section className="panel panel-content">
        <h2>리그 친숙도</h2>
        <p>
          근무 경험이 있는 리그는 능력치를 확인할 수 있습니다. 낯선 리그 선수는 ?로 표시하며 파견
          보고가 도착하면 관찰 범위를 보여줍니다.
        </p>
        <div className="scout-toolbar">
          {leagues.map((l) => (
            <span className="pill" key={l.id}>
              {l.flag} {l.name} · {g.knowledge?.leagues.includes(l.id) ? '친숙함' : '관찰 필요'}
            </span>
          ))}
        </div>
      </section>
      <div className="preset-buttons" role="group" aria-label="스카우팅 화면">
        {[
          ['missions', '관찰 임무'],
          ['reports', `보고 · 비교 ${reports.length}`],
          ['shortlist', `관심 명단 ${s?.shortlist.length || 0}`],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'selected' : ''}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'missions' && (
        <>
          <section className="panel scout-assignment-form">
            <h2>리그에 스카우트 파견</h2>
            <p>
              {scout
                ? `담당 ${scout.name} · 능력 ${scout.skill}`
                : '코치 화면에서 스카우트를 선임해 주세요.'}{' '}
              · 가용 예산 {money(g.budget)}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await act({ type: 'assignScout', league, pos, maxAge, days, scoutId: scout?.id });
              }}
            >
              <div className="scout-form-grid">
                <label>
                  관찰 리그
                  <select
                    value={league}
                    disabled={busy}
                    onChange={(e) => setLeague(e.target.value)}
                  >
                    {leagues.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.flag} {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  포지션
                  <select value={pos} disabled={busy} onChange={(e) => setPos(e.target.value)}>
                    {Object.entries({
                      all: '전체',
                      P: '투수',
                      C: '포수',
                      IF: '내야수',
                      OF: '외야수',
                      DH: '지명타자',
                    }).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  최대 나이
                  <input
                    type="number"
                    min="16"
                    max="50"
                    step="1"
                    required
                    value={maxAge}
                    disabled={busy}
                    onChange={(e) => setMaxAge(Number(e.target.value))}
                  />
                </label>
                <label>
                  관찰 기간
                  <select
                    value={days}
                    disabled={busy}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    {scoutingDurations.map((d) => (
                      <option key={d} value={d}>
                        {d}일
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="scout-toolbar">
                <button
                  className="button primary"
                  disabled={busy || !scout || active.length >= 3 || cost > g.budget}
                >
                  파견 시작 · {money(cost)}
                </button>
                <small>최대 3명 추천 · 파견비 선지급, 취소 시 반환 없음</small>
              </div>
            </form>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>진행 중인 관찰</h2>
              <Link href="/?view=market" className="text-button">
                특정 선수 찾아 관찰 →
              </Link>
            </div>
            {!active.length && (
              <p className="scout-empty">
                진행 중인 임무가 없습니다. 리그를 지정하거나 선수 상세의 관찰 탭에서 의뢰하세요.
              </p>
            )}
            {active.map((t) => {
              const elapsed = Math.max(0, daysBetween(t.started, gameDate(g)));
              return (
                <article className="scout-mission" key={t.id}>
                  <div>
                    <h3>{t.label}</h3>
                    <p>
                      {t.scoutName} · {t.due} 보고 예정 · {money(t.cost)}
                    </p>
                    <progress
                      aria-label={`${t.label} 관찰 진척`}
                      value={Math.min(t.days, elapsed)}
                      max={t.days}
                    />
                    <small>
                      {elapsed} / {t.days}일 관찰
                    </small>
                  </div>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void act({ type: 'cancelScout', id: t.id })}
                  >
                    관찰 취소
                  </button>
                </article>
              );
            })}
          </section>
        </>
      )}
      {tab === 'reports' && (
        <>
          <ScoutComparison reports={reports.filter((r) => selected.includes(r.playerId))} g={g} />
          {!reports.length && (
            <p className="scout-empty">관찰 기간이 끝나면 보고가 도착하고 날짜 진행이 멈춥니다.</p>
          )}
          <div className="scout-report-grid">
            {reports.map((r) => {
              const p = market.get(r.playerId),
                listed = s?.shortlist.includes(r.playerId);
              return (
                <section key={r.playerId}>
                  <ScoutReportCard report={r} />
                  <div className="scout-toolbar">
                    <label className="scout-compare-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(r.playerId)}
                        disabled={!selected.includes(r.playerId) && selected.length >= 3}
                        onChange={() => toggle(r.playerId)}
                      />{' '}
                      비교 선택
                    </label>
                    {p ? (
                      <>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void act({ type: 'shortlistPlayer', id: p.id, add: !listed })
                          }
                        >
                          {listed ? '관심 해제' : '관심 등록'}
                        </button>
                        <button className="text-button" onClick={() => onPlayer(p)}>
                          선수 상세
                        </button>
                        <button
                          className="button primary compact"
                          disabled={busy}
                          onClick={() => onNegotiate(p)}
                        >
                          계약 제안
                        </button>
                      </>
                    ) : (
                      <small>소속 변경 · 현재 영입 대상에서 제외</small>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      {tab === 'shortlist' && (
        <section className="panel">
          <div className="panel-header">
            <h2>관심 선수</h2>
            <Link className="text-button" href="/?view=market">
              선수 탐색 →
            </Link>
          </div>
          {!s?.shortlist.length && (
            <p className="scout-empty">선수 상세의 관찰 탭에서 관심 선수를 등록하세요.</p>
          )}
          {s?.shortlist.map((id) => {
            const p = market.get(id),
              r = reports.find((r) => r.playerId === id);
            return (
              <article className="scout-mission" key={id}>
                <div>
                  <h3>{p?.name || r?.playerName || '소속이 변경된 선수'}</h3>
                  <p>
                    {p
                      ? `${getClub(p.club)?.name || 'FA'} · ${p.age}세 · ${p.pos}`
                      : '현재 외부 영입 대상이 아닙니다.'}
                  </p>
                  <small>{r ? `${r.date} 관찰 · ${r.verdict}` : '관찰 보고 없음'}</small>
                </div>
                <div className="scout-toolbar">
                  {p && (
                    <button className="button secondary compact" onClick={() => onPlayer(p)}>
                      상세 · 관찰
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void act({ type: 'shortlistPlayer', id, add: false })}
                  >
                    관심 해제
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
