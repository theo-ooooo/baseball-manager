'use client';
import { useScoutCenter } from './use-scout-center';
import Link from 'next/link';
import { Binoculars, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState, Player } from '@dugout/shared/types';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import { scoutingDurations } from '@dugout/shared/scouting';
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
  initialTab,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onNegotiate: (p: Player) => void;
  initialTab?: string;
}) {
  const { leagues, getClub } = useWorld();
  const {
    dispatch,
    assignmentOpen,
    setAssignmentOpen,
    tab,
    setTab,
    league,
    setLeague,
    pos,
    setPos,
    maxAge,
    setMaxAge,
    days,
    setDays,
    selected,
    market,
    active,
    scout,
    reports,
    cost,
    toggle,
  } = useScoutCenter(g, act, initialTab);
  const s = g.scouting;
  return (
    <div className="scouting-center">
      <header className="scout-command-heading">
        <div>
          <Binoculars size={20} />
          <h2>관찰 현황</h2>
          <span>{active.length} / 3명 파견 중</span>
        </div>
        <button
          className="button primary compact"
          onClick={() => setAssignmentOpen(true)}
          disabled={busy || active.length >= 3}
        >
          <Plus size={16} />새 파견
        </button>
      </header>
      <div className="preset-buttons" role="group" aria-label="스카우트 화면">
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
          {!!reports.length && (
            <ScoutComparison reports={reports.filter((r) => selected.includes(r.playerId))} g={g} />
          )}
          {!reports.length && (
            <section className="panel panel-content">
              <h3>아직 완성된 관찰 보고서가 없습니다</h3>
              <p className="scout-empty">
                {active.length
                  ? '관찰 중입니다. 관찰 임무에서 보고 예정일을 확인하세요. 관찰이 끝나면 이곳에 보고서가 표시됩니다.'
                  : '새 파견으로 관찰을 의뢰하세요. 7일·14일·28일 중 선택한 기간이 끝나면 이곳에 보고서가 표시됩니다.'}
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => (active.length ? setTab('missions') : setAssignmentOpen(true))}
              >
                {active.length ? '관찰 임무 · 예정일 확인' : '새 스카우트 파견'}
              </button>
            </section>
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
                        {p.club === 'fa' ? (
                          <button
                            className="button primary compact"
                            disabled={busy}
                            onClick={() => onNegotiate(p)}
                          >
                            FA 계약 제안
                          </button>
                        ) : (
                          <Link
                            className="button primary compact"
                            href={`/?view=trade&target=${encodeURIComponent(p.id)}`}
                          >
                            트레이드 검토
                          </Link>
                        )}
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
      <details className="panel panel-content scout-knowledge">
        <summary>리그 친숙도 · 관찰 범위 확인</summary>
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
      </details>
      <Dialog
        open={assignmentOpen}
        onOpenChange={(open) => {
          if (!busy) setAssignmentOpen(open);
        }}
      >
        <DialogContent className="scout-dispatch-dialog">
          <DialogHeader>
            <DialogTitle>새 스카우트 파견</DialogTitle>
            <DialogDescription>
              관찰할 리그와 선수 조건을 정한 뒤 담당 스카우트에게 의뢰합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="scout-assignment-form">
            <p>
              {scout
                ? `담당 ${scout.name} · 능력 ${scout.skill}`
                : '코치 화면에서 스카우트를 선임해 주세요.'}{' '}
              · 가용 예산 {money(g.budget)}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await dispatch();
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
