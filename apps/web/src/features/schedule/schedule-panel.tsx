'use client';
import { InternationalCalendarPanel } from './international-calendar-panel';
import { InternationalTeamsPanel } from './international-teams-panel';
import { ClubBadge } from '../../components/club-badge';
import { useState } from 'react';
import type { GameState, Result } from '@dugout/shared/types';
import { addDays, daysBetween, gameDate, dateLabel } from '@dugout/shared/calendar';
import { preseasonFixtures } from '@dugout/shared/management';
import { useWorld } from '../career/world-context';
export function SchedulePanel({ g, replay }: { g: GameState; replay: (r: Result) => void }) {
  const { clubs, getClub, fixtures, onDate, scheduleNote } = useWorld(),
    lid = getClub(g.club).league;
  const [scope, setScope] = useState('league'),
    [month, setMonth] = useState(gameDate(g).slice(0, 7));
  const list = fixtures(g, lid),
    first = month + '-01',
    last = addDays(month + '-28', 4),
    days = daysBetween(first, last.slice(0, 7) + '-01');
  const today = gameDate(g),
    monthFixtures = list.filter((f) => f.date.startsWith(month));
  const scores = new Map(
    [...(g.worldResults || []), ...g.history]
      .filter((r) => r.fixtureId)
      .map((r) => [r.fixtureId!, r]),
  );
  const changeMonth = (n: number) => {
    const d = new Date(month + '-15T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <>
      <InternationalCalendarPanel g={g} />
      <InternationalTeamsPanel g={g} />
      <section className="panel">
        <div className="panel-header">
          <h2>경기 일정</h2>
          <span>{scheduleNote(g)}</span>
        </div>
        <div className="toolbar">
          <div className="toolbar-controls">
            <button
              className="button secondary compact"
              aria-label="이전 달"
              onClick={() => changeMonth(-1)}
            >
              ←
            </button>
            <strong>{month.replace('-', '년 ')}월</strong>
            <button
              className="button secondary compact"
              aria-label="다음 달"
              onClick={() => changeMonth(1)}
            >
              →
            </button>
            <button className="text-button" onClick={() => setMonth(today.slice(0, 7))}>
              현재 날짜
            </button>
          </div>
          <select aria-label="일정 범위" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="league">리그 전체 경기</option>
            <option value="club">내 구단 경기</option>
          </select>
        </div>
        <div className="season-calendar">
          {Array.from({ length: days }, (_, i) => {
            const date = addDays(first, i),
              day = daysBetween(g.calendar!.openingDate, date),
              fs = onDate(g, lid, day).filter(
                (f) => scope === 'league' || f.home === g.club || f.away === g.club,
              );
            const friendly = g.rules?.preseason
              ? preseasonFixtures(g, { clubs }).find((f) => f.day === day)
              : null;
            return (
              <div key={date} className={`calendar-day ${date === today ? 'today' : ''}`}>
                <div className="calendar-date">
                  <strong>{dateLabel(g, day)}</strong>
                  {date === today && <span className="pill lime">오늘</span>}
                </div>
                <div className="calendar-games">
                  {fs.map((f) => {
                    const r = scores.get(f.id),
                      own = f.home === g.club || f.away === g.club;
                    return (
                      <div className={`calendar-game ${own ? 'own' : ''}`} key={f.id}>
                        <span className="club-label">
                          <ClubBadge club={getClub(f.away)} size="tiny" />
                          {getClub(f.away).name}
                        </span>
                        <strong>{r ? `${r.awayScore} : ${r.homeScore}` : 'vs'}</strong>
                        <span className="club-label">
                          <ClubBadge club={getClub(f.home)} size="tiny" />
                          {getClub(f.home).name}
                        </span>
                        <small>
                          {r ? '종료' : date < today ? '경기 종료' : f.time || '예정'} ·{' '}
                          {getClub(f.home).city}
                        </small>
                        {own && r && (
                          <button className="text-button" onClick={() => replay(r)}>
                            리플레이 →
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {friendly && (
                    <div className="calendar-game own">
                      <span>{getClub(friendly.pair[1]).name}</span>
                      <strong>연습</strong>
                      <span>{getClub(friendly.pair[0]).name}</span>
                    </div>
                  )}
                  {!fs.length && !friendly && (
                    <span className="muted">
                      {day < 0 ? '프리시즌 · 훈련' : '휴식일 · 선수단 정비'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="panel-foot">
          이달{' '}
          {
            monthFixtures.filter(
              (f) => scope === 'league' || f.home === g.club || f.away === g.club,
            ).length
          }
          경기 · 왼쪽 원정 / 오른쪽 홈<span>진행 버튼은 하루의 경기와 휴식을 함께 처리합니다.</span>
        </div>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>우리 구단 경기 기록</h2>
          <span>{g.history.length}경기</span>
        </div>
        {g.history.map((r) => (
          <button className="result-row" key={r.id} onClick={() => replay(r)}>
            <span className="muted">
              {r.date?.slice(5).replace('-', '/') || dateLabel(g, r.day)}
            </span>
            <span className="club-label">
              <ClubBadge club={getClub(r.away)} size="tiny" />
              {getClub(r.away).short}
            </span>
            <strong>
              {r.awayScore} : {r.homeScore}
            </strong>
            <span className="club-label">
              <ClubBadge club={getClub(r.home)} size="tiny" />
              {getClub(r.home).short}
            </span>
            <span>리플레이 →</span>
          </button>
        ))}
      </section>
    </>
  );
}
