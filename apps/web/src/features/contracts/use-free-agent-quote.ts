'use client';
import { careerFetch } from '../career/career-slot';
import { useEffect, useState } from 'react';
import type { FreeAgentTerms } from '@dugout/shared/types';

export function useFreeAgentQuote(id: string | undefined, club: string, year: number, day: number) {
  const [result, setResult] = useState<{ key: string; terms?: FreeAgentTerms; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const key = `${id}:${club}:${year}:${day}:${attempt}`;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await careerFetch(
          `/api/career/contracts/${encodeURIComponent(id!)}/quote`,
          {
            signal: controller.signal,
            cache: 'no-store',
          },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || body.message || 'FA 요구 조건을 불러오지 못했습니다.');
        if (!controller.signal.aborted) setResult({ key, terms: body });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ key, error: error instanceof Error ? error.message : '요구 조건 조회 실패' });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, key]);
  const current = result?.key === key ? result : undefined;
  return {
    quote: current?.terms,
    error: current?.error,
    loading: !!id && !current,
    retry: () => setAttempt((n) => n + 1),
  };
}
