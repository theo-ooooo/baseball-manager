'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GameState, Player } from '@dugout/shared/types';
import { isUnemployed, managerJobOpen } from '@dugout/shared/manager-career';
import { gameDate } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';
import { Badge } from '../../components/game-ui';
import { PlayerTable } from '../players/player-table';
import { ManagerApplication } from '../career/manager-application';
import type { Act } from '../career/game-contracts';
export function ClubProfile({
  g,
  clubId,
  act,
  busy,
  onPlayer,
}: {
  g: GameState;
  clubId: string;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
}) {
  const { clubs, getClub, getLeague, rosterFor, standings, fixtures, coachPool } = useWorld();
  const [tab, setTab] = useState('overview'),
    [applying, setApplying] = useState(false);
  const c = clubs.find((c) => c.id === clubId);
  if (!c)
    return (
      <section className="panel panel-content">
        <h2>구단을 찾을 수 없습니다.</h2>
        <Link href="/?view=world">리그 · 세계로</Link>
      </section>
    );
  const l = getLeague(c.league),
    roster = rosterFor(g, c.id),
    table = standings(g, c.league),
    rank = table.findIndex((s) => s.club === c.id) + 1,
    row = table[rank - 1],
    own = !isUnemployed(g) && g.club === c.id,
    job = g.managerJobs?.[c.id];
  const schedule = fixtures(g, c.league).filter((f) => f.home === c.id || f.away === c.id),
    results = [...g.history, ...(g.worldResults || [])].filter(
      (r) => r.home === c.id || r.away === c.id,
    );
  const resultMap = new Map(results.map((r) => [r.id, r])),
    staff = own ? g.staff : coachPool().filter((coach) => coach.sourceClub === c.id);
  const events = (g.simulation?.events || []).filter(
    (e) => e.club === c.id || e.otherClub === c.id,
  );
  const scheduleRows =
    tab === 'schedule' ? schedule : schedule.filter((f) => f.date >= gameDate(g)).slice(0, 5);
  return (
    <div className="club-profile">
      <header className="club-profile-hero panel">
        <Badge club={c} size="large" />
        <div>
          <small>
            {l.flag} {l.label} · {c.city}
          </small>
          <h1>{c.name}</h1>
          <p>
            {c.division || l.country} · {g.year}시즌
          </p>
        </div>
        {job && !own && managerJobOpen(job) && (
          <button className="button primary" disabled={busy} onClick={() => setApplying(true)}>
            감독직에 관심 표명
          </button>
        )}
        {own && (
          <Link className="button secondary" href="/?view=vision">
            구단 비전
          </Link>
        )}
      </header>
      <nav className="section-tabs" aria-label="구단 정보">
        {[
          ['overview', '개요'],
          ['squad', '선수단'],
          ['schedule', '일정 · 결과'],
          ['staff', '감독 · 스태프'],
          ['news', '구단 소식'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <>
          <div className="club-profile-facts">
            <div>
              <small>리그 순위</small>
              <strong>{row && row.w + row.l + row.d > 0 ? `${rank}위` : '시즌 준비'}</strong>
            </div>
            <div>
              <small>시즌 성적</small>
              <strong>{row ? `${row.w}승 ${row.l}패` : '—'}</strong>
            </div>
            <div>
              <small>감독</small>
              <strong>{job?.managerName || c.manager?.name || '정보 없음'}</strong>
            </div>
            <div>
              <small>등록 선수</small>
              <strong>{roster.length}명</strong>
            </div>
          </div>
          <section className="panel panel-content">
            <h2>다가오는 일정</h2>
            {scheduleRows.length ? (
              scheduleRows.map((f) => (
                <div className="club-fixture-row" key={f.id}>
                  <time>{f.date}</time>
                  <Link href={`/clubs/${encodeURIComponent(f.away)}`}>{getClub(f.away).name}</Link>
                  <strong>VS</strong>
                  <Link href={`/clubs/${encodeURIComponent(f.home)}`}>{getClub(f.home).name}</Link>
                </div>
              ))
            ) : (
              <p>남은 정규시즌 일정이 없습니다.</p>
            )}
          </section>
        </>
      )}
      {tab === 'squad' && (
        <section className="panel">
          <div className="panel-header">
            <h2>선수단 · {roster.length}명</h2>
            <span>선수를 누르면 상세 프로필로 이동합니다.</span>
          </div>
          <PlayerTable players={roster} onPlayer={onPlayer} kind={own ? 'squad' : 'market'} g={g} />
        </section>
      )}
      {tab === 'schedule' && (
        <section className="panel panel-content">
          <h2>{g.year} 일정 · 결과</h2>
          {schedule.map((f) => {
            const r =
              resultMap.get(f.id) ||
              results.find((r) => r.date === f.date && r.home === f.home && r.away === f.away);
            return (
              <div className="club-fixture-row" key={f.id}>
                <time>{f.date}</time>
                <Link href={`/clubs/${encodeURIComponent(f.away)}`}>{getClub(f.away).name}</Link>
                <strong>
                  {r
                    ? `${r.awayScore} : ${r.homeScore}`
                    : f.date < gameDate(g)
                      ? '기록 없음'
                      : 'VS'}
                </strong>
                <Link href={`/clubs/${encodeURIComponent(f.home)}`}>{getClub(f.home).name}</Link>
              </div>
            );
          })}
        </section>
      )}
      {tab === 'staff' && (
        <section className="panel panel-content">
          <h2>감독 · 코치진</h2>
          <div className="club-staff-row">
            <strong>{job?.managerName || c.manager?.name || '정보 없음'}</strong>
            <span>감독 · {job?.vacant ? '공석' : `이사회 신임도 ${job?.confidence ?? '—'}%`}</span>
          </div>
          {staff.map((coach, i) => (
            <div className="club-staff-row" key={`${coach.id}-${i}`}>
              <strong>{coach.name}</strong>
              <span>
                {coach.role} · {coach.style}
              </span>
            </div>
          ))}
          {!staff.length && <p>공개된 코치 명단이 없습니다.</p>}
          {c.manager && (
            <p className="muted">
              초기 감독 명단 기준 · {c.manager.asOf}{' '}
              <a href={c.manager.source} target="_blank" rel="noreferrer">
                공식 명단
              </a>
            </p>
          )}
        </section>
      )}
      {tab === 'news' && (
        <section className="panel panel-content">
          <h2>구단 소식</h2>
          {events.map((e) => (
            <div className="club-staff-row" key={e.id}>
              <time>{e.date}</time>
              <p>{e.text}</p>
            </div>
          ))}
          {!events.length && <p>아직 기록된 구단 소식이 없습니다.</p>}
        </section>
      )}
      {applying && (
        <ManagerApplication
          g={g}
          clubId={c.id}
          act={act}
          busy={busy}
          close={() => setApplying(false)}
        />
      )}
    </div>
  );
}
