'use client';
import { useEffect, useState } from 'react';
import type { Result } from '@dugout/shared/types';
export function useMatchReport(summary: Result, club: string) {
  const [side, setSide] = useState(club === summary.home ? 1 : 0);
  const [detail, setDetail] = useState<Result | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const complete = summary.log.length > 0 && !!summary.replayTeams;
  useEffect(() => {
    if (complete) return;
    const controller = new AbortController();
    fetch(`/api/career/matches/${encodeURIComponent(summary.id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('상세 경기 기록을 불러오지 못했습니다.');
        return response.json() as Promise<Result>;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setDetail(data);
          setError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [summary.id, complete, attempt]);
  return {
    side,
    setSide,
    result: complete ? summary : detail?.id === summary.id ? detail : null,
    error,
    retry: () => {
      setError('');
      setAttempt((v) => v + 1);
    },
  };
}
