'use client';
import { useEffect, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { TradeRecommendations, TradeSuggestion } from '@dugout/shared/trade-recommendations';
import { careerFetch } from '../career/career-slot';
export function useTradeRecommendations(
  g: GameState,
  active: boolean,
  query: { club?: string; incoming?: string[]; offerId?: string },
) {
  const key = JSON.stringify(query),
    [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    game: GameState;
    key: string;
    result?: TradeRecommendations;
    error?: string;
  }>();
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    careerFetch('/api/career/trades/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: key,
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || '추천안을 불러오지 못했습니다.');
        return data as TradeRecommendations;
      })
      .then((result) => {
        if (!controller.signal.aborted) setState({ game: g, key, result });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            game: g,
            key,
            error: error instanceof Error ? error.message : '추천안을 불러오지 못했습니다.',
          });
      });
    return () => controller.abort();
  }, [active, key, g, attempt]);
  const current = state?.game === g && state.key === key ? state : undefined;
  return {
    result: current?.result,
    error: current?.error,
    loading: active && !current,
    retry: () => {
      setState(undefined);
      setAttempt((x) => x + 1);
    },
  };
}

export function useTradeRecommendationPicker(
  g: GameState,
  query: { club?: string; incoming?: string[]; offerId?: string },
  select: (suggestion: TradeSuggestion) => void,
) {
  const [open, setOpen] = useState(false),
    request = useTradeRecommendations(g, open, query);
  return {
    open,
    setOpen,
    ...request,
    choose(s: TradeSuggestion) {
      select(s);
      setOpen(false);
    },
  };
}
