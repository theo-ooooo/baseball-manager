'use client';
import { useMemo, useState } from 'react';
import {
  battingMetrics,
  pitchingMetrics,
  playerLeaders,
  type LeaderMetric,
} from '@dugout/shared/player-leaders';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';

export function usePlayerLeaders(g: GameState, league: string) {
  const { clubs, rosterFor } = useWorld();
  const [kind, setKind] = useState<'batting' | 'pitching'>('batting');
  const [metric, setMetric] = useState<LeaderMetric>('avg');
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const players = clubs.filter((c) => c.league === league).flatMap((c) => rosterFor(g, c.id));
    const games = new Map((g.standings[league] || []).map((s) => [s.club, s.w + s.l + s.d]));
    return playerLeaders(players, games, metric, qualifiedOnly);
  }, [clubs, rosterFor, g, league, metric, qualifiedOnly]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, totalPages - 1);
  return {
    kind,
    metric,
    qualifiedOnly,
    rows: rows.slice(currentPage * 20, currentPage * 20 + 20),
    total: rows.length,
    metrics: kind === 'batting' ? battingMetrics : pitchingMetrics,
    currentPage,
    totalPages,
    selectKind(value: 'batting' | 'pitching') {
      setKind(value);
      setMetric(value === 'batting' ? 'avg' : 'era');
      setPage(0);
    },
    selectMetric(value: LeaderMetric) {
      setMetric(value);
      setPage(0);
    },
    selectQualified(value: boolean) {
      setQualifiedOnly(value);
      setPage(0);
    },
    previous() {
      setPage(Math.max(0, currentPage - 1));
    },
    next() {
      setPage(Math.min(totalPages - 1, currentPage + 1));
    },
  };
}
