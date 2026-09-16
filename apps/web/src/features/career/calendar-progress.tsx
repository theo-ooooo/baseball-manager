'use client';
import type { CSSProperties } from 'react';
import { CalendarDays, CircleDot, FileText, LoaderCircle, Pause, X } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { dateLabel, gameDate } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import { calendarDayResults, type CalendarJourney } from './calendar-progress-view';

export function CalendarProgress({
  journey,
  g,
  pause,
  close,
  onReports,
  onMatchday,
}: {
  journey: CalendarJourney;
  g: GameState;
  pause: () => void;
  close: () => void;
  onReports: () => void;
  onMatchday: () => void;
}) {
  const { nextFixture, getClub } = useWorld();
  const days = Array.from({ length: journey.limit + 7 }, (_, i) => journey.start - 3 + i);
  const reports = g.progress?.newsIds.length || 0;
  return (
    <section className="calendar-progress" aria-label="날짜 진행 달력" aria-busy={journey.running}>
      <div className="calendar-progress-heading">
        <div>
          {journey.running ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <CalendarDays size={18} />
          )}
          <strong role="status">{journey.status}</strong>
          <span>{dateLabel(g, journey.day)}</span>
        </div>
        {journey.running ? (
          <button className="button secondary compact" onClick={pause}>
            <Pause size={15} />
            멈추기
          </button>
        ) : (
          <div>
            {g.progress?.stop === 'fixture' && (
              <button className="text-button" onClick={onMatchday}>
                경기 준비 →
              </button>
            )}
            {reports > 0 && (
              <button className="text-button" onClick={onReports}>
                리포트 확인 →
              </button>
            )}
            <button className="icon-button" aria-label="진행 달력 닫기" onClick={close}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="calendar-progress-window" aria-hidden="true">
        <div
          className="calendar-progress-track"
          style={{ '--advanced': journey.day - journey.start } as CSSProperties}
        >
          {days.map((day) => {
            const results = calendarDayResults(g, day);
            const result = results[0];
            const pair = result ? [result.home, result.away] : nextFixture({ ...g, day });
            const opponent = pair ? getClub(pair.find((id) => id !== g.club)!) : null;
            return (
              <div
                key={day}
                className={`calendar-progress-day ${day === journey.day ? 'current' : day < journey.day ? 'passed' : ''}`}
              >
                <small>{dateLabel(g, day).split(' ').at(-1)}</small>
                <b>{gameDate(g, day).slice(5).replace('-', ' / ')}</b>
                <span
                  title={
                    result
                      ? `${getClub(result.away).short} ${result.awayScore} : ${result.homeScore} ${getClub(result.home).short}`
                      : undefined
                  }
                >
                  {opponent ? (
                    <>
                      <CircleDot size={13} />
                      {opponent.short}
                      {result &&
                        ` ${result.home === g.club ? result.homeScore : result.awayScore}:${result.home === g.club ? result.awayScore : result.homeScore}`}
                      {results.length > 1 && ` · ${results.length}경기`}
                    </>
                  ) : day % 7 === 0 ? (
                    <>
                      <FileText size={13} />
                      주간 보고
                    </>
                  ) : (
                    '훈련 · 휴식'
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p>
        {journey.running
          ? '하루씩 자동 저장 중 · 경기나 확인이 필요한 보고가 생기면 멈춥니다.'
          : `${journey.day - journey.start}일 진행 · 저장된 날짜부터 이어갑니다.`}
      </p>
    </section>
  );
}
