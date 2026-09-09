'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, CircleDot, FileText, LoaderCircle, Pause, X } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { dateLabel, gameDate } from '@dugout/shared/calendar';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';

type Journey = { start: number; day: number; limit: number; status: string; running: boolean };
export function useCalendarProgress(act: Act) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const active = useRef(false),
    cancelled = useRef(false);
  const reducedMotion = useReducedMotion();
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );
  async function run(g: GameState, limit = 45, simulateGames = false) {
    if (active.current) return null;
    active.current = true;
    cancelled.current = false;
    let current = g;
    let failed = false;
    let status = '일정을 확인하고 있습니다';
    setJourney({ start: g.day, day: g.day, limit, status, running: true });
    try {
      for (let i = 0; i < limit && !cancelled.current; i++) {
        const [next] = await Promise.all([
          act({ type: 'continueDay', simulateGames }),
          new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 420)),
        ]);
        if (!next) {
          failed = true;
          status = '저장 상태를 확인해 주세요';
          break;
        }
        current = next;
        const stop = next.progress?.stop;
        status =
          stop === 'decision'
            ? '답변이 필요한 면담이 도착했습니다'
            : stop === 'report'
              ? `새 리포트 ${next.progress!.newsIds.length}건이 도착했습니다`
              : stop === 'fixture'
                ? '경기일에 도착했습니다'
                : stop === 'season'
                  ? '시즌 일정이 변경됐습니다'
                  : '다음 일정을 확인하고 있습니다';
        setJourney({ start: g.day, day: next.day, limit, status, running: true });
        if (stop || (next.day === g.day && i === 0)) break;
      }
      if (cancelled.current) status = '진행을 멈췄습니다';
      else if (!current.progress?.stop && status !== '저장 상태를 확인해 주세요')
        status = `${current.day - g.day}일 진행했습니다`;
      return failed ? null : current;
    } finally {
      active.current = false;
      setJourney(failed ? null : { start: g.day, day: current.day, limit, status, running: false });
    }
  }
  return {
    journey,
    run,
    pause: () => {
      cancelled.current = true;
    },
    close: () => setJourney(null),
  };
}

export function CalendarProgress({
  journey,
  g,
  pause,
  close,
  onReports,
  onMatchday,
}: {
  journey: Journey;
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
            const pair = nextFixture({ ...g, day });
            const opponent = pair ? getClub(pair.find((id) => id !== g.club)!) : null;
            return (
              <div
                key={day}
                className={`calendar-progress-day ${day === journey.day ? 'current' : day < journey.day ? 'passed' : ''}`}
              >
                <small>{dateLabel(g, day).split(' ').at(-1)}</small>
                <b>{gameDate(g, day).slice(5).replace('-', ' / ')}</b>
                <span>
                  {opponent ? (
                    <>
                      <CircleDot size={13} />
                      {opponent.short}
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
          ? '하루씩 자동 저장 중 · 경기나 새 리포트가 생기면 멈춥니다.'
          : `${journey.day - journey.start}일 진행 · 저장된 날짜부터 이어갑니다.`}
      </p>
    </section>
  );
}
