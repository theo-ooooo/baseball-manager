'use client';
import { useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import { overall } from '@dugout/shared/game-view';
import { developmentChange, visibleChange } from '@dugout/shared/development';
import { isUnrated } from '@dugout/shared/ratings';
import { pitchingAssignment } from './pitching-panel';

export function useSquadBrowser(g: GameState) {
  const [filter, setFilter] = useState('all');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('rating');
  const [detailed, setDetailed] = useState(false);
  const [growth, setGrowth] = useState('all');
  const [squad, setSquad] = useState('all');
  const [condition, setCondition] = useState('all');
  const matchesGrowth = (p: Player, value: string) => {
    const change = isUnrated(p) ? 0 : visibleChange(developmentChange(p));
    return (
      value === 'all' ||
      (value === 'improving'
        ? change > 0
        : value === 'declining'
          ? change < 0
          : p.development?.stage === value)
    );
  };
  const list = g.roster
    .filter(
      (p) =>
        (squad === 'all' || (p.squad || 'first') === squad) &&
        (condition === 'all' || p.condition < 70) &&
        (filter === 'all' || p.pos === filter || (filter === 'young' && p.age <= 23)) &&
        (filter !== 'P' || role === 'all' || pitchingAssignment(g, p) === role) &&
        matchesGrowth(p, growth) &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'growth'
        ? (isUnrated(b) ? 0 : (developmentChange(b) ?? 0)) -
          (isUnrated(a) ? 0 : (developmentChange(a) ?? 0))
        : sort === 'age'
          ? a.age - b.age
          : sort === 'salary'
            ? b.salary - a.salary
            : overall(b) - overall(a),
    );
  const first = g.roster.filter((p) => p.squad !== 'reserve').length;
  const tired = g.roster.filter((p) => p.condition < 70).length;
  return {
    filter,
    role,
    query,
    sort,
    detailed,
    growth,
    squad,
    condition,
    list,
    first,
    tired,
    setFilter: (value: string) => {
      setFilter(value);
      setRole('all');
    },
    setRole,
    setQuery,
    setSort,
    setDetailed,
    setGrowth,
    setSquad,
    setCondition,
    reset: () => {
      setFilter('all');
      setRole('all');
      setQuery('');
      setGrowth('all');
      setSquad('all');
      setCondition('all');
    },
  };
}
