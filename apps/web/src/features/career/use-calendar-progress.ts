'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import type { Act } from './game-contracts';
import { visibleCalendarJourney, type CalendarJourney } from './calendar-progress-view';

export function useCalendarProgress(g: GameState | null, act: Act) {
  const [journey, setJourney] = useState<CalendarJourney | null>(null);
  const active = useRef(false),
    cancelled = useRef(false),
    mounted = useRef(true);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    mounted.current = true;
    return () => {
      cancelled.current = true;
      mounted.current = false;
    };
  }, []);
  async function run(g: GameState, limit = 45, simulateGames = false) {
    if (active.current) return null;
    active.current = true;
    cancelled.current = false;
    let current = g;
    const vacation = !!g.managerCareer?.vacationUntil;
    let failed = false;
    let status = vacation ? '휴가 일정을 진행하고 있습니다' : '일정을 확인하고 있습니다';
    setJourney({
      year: g.year,
      club: g.club,
      phase: g.phase,
      start: g.day,
      day: g.day,
      limit,
      status,
      running: true,
    });
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
                  : vacation
                    ? '휴가 중 · 보고는 복귀 후 확인합니다'
                    : '다음 일정을 확인하고 있습니다';
        if (vacation && !next.managerCareer?.vacationUntil)
          status = '휴가 복귀 · 먼저 결정할 일을 모았습니다';
        if (mounted.current)
          setJourney({
            year: next.year,
            club: next.club,
            phase: next.phase,
            start: g.day,
            day: next.day,
            limit,
            status,
            running: true,
          });
        if (
          stop ||
          (vacation && !next.managerCareer?.vacationUntil) ||
          (next.day === g.day && i === 0)
        )
          break;
      }
      if (cancelled.current) status = '진행을 멈췄습니다';
      else if (!current.progress?.stop && status !== '저장 상태를 확인해 주세요')
        status = `${current.day - g.day}일 진행했습니다`;
      return failed ? null : current;
    } finally {
      active.current = false;
      if (mounted.current)
        setJourney(
          failed
            ? null
            : {
                year: current.year,
                club: current.club,
                phase: current.phase,
                start: g.day,
                day: current.day,
                limit,
                status,
                running: false,
              },
        );
    }
  }
  return {
    journey: visibleCalendarJourney(journey, g),
    run,
    pause: () => {
      cancelled.current = true;
    },
    close: () => setJourney(null),
  };
}
