'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type GameState, type Player, overall } from '@dugout/shared/game-view';
import { Choice, SearchBox, Empty } from '../../components/game-ui';
import { PlayerTable } from '../players/player-table';
import { pitchingAssignment, roleNames, type PitchingAssignment } from './pitching-panel';
import { useRosterMoves } from './roster-moves';
import type { Act } from '../career/game-contracts';
import { developmentChange, growthLabels, visibleChange } from '@dugout/shared/development';
import { isUnrated } from '@dugout/shared/ratings';

const roleFilters: Exclude<PitchingAssignment, ''>[] = [
  'starter',
  'setup',
  'chase',
  'bullpen',
  'closer',
  'reserve',
];

export function Squad({
  g,
  onPlayer,
  act,
  busy,
}: {
  g: GameState;
  onPlayer: (p: Player) => void;
  act: Act;
  busy: boolean;
}) {
  const moves = useRosterMoves({ g, act, busy });
  const [filter, setFilter] = useState('all'),
    [role, setRole] = useState('all'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('rating'),
    [detailed, setDetailed] = useState(false);
  const [growth, setGrowth] = useState('all');
  const matchesGrowth = (p: Player, filter: string) => {
    const change = isUnrated(p) ? 0 : visibleChange(developmentChange(p));
    return (
      filter === 'all' ||
      (filter === 'improving'
        ? change > 0
        : filter === 'declining'
          ? change < 0
          : p.development?.stage === filter)
    );
  };
  const pitchers = g.roster.filter((p) => p.pos === 'P');
  const roleCount = (r: string) => pitchers.filter((p) => pitchingAssignment(g, p) === r).length;
  const list = g.roster
    .filter(
      (p) =>
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
  return (
    <section className="panel">
      <div className="toolbar">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
            setRole('all');
          }}
        >
          <TabsList variant="line">
            {[
              ['all', '전체 선수'],
              ['P', '투수'],
              ['C', '포수'],
              ['IF', '내야수'],
              ['OF', '외야수'],
              ['young', '유망주'],
            ].map((t) => (
              <TabsTrigger value={t[0]} key={t[0]}>
                {t[1]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="toolbar-controls">
          <SearchBox value={query} onChange={setQuery} />
          <button
            className="button secondary compact"
            aria-pressed={detailed}
            onClick={() => setDetailed((value) => !value)}
          >
            {detailed ? '핵심만 보기' : '상세 열 보기'}
          </button>
          <Choice
            label="선수 정렬"
            value={sort}
            onChange={setSort}
            items={[
              { value: 'rating', label: '능력치 순' },
              { value: 'growth', label: '최근 성장량 순' },
              { value: 'age', label: '어린 선수 순' },
              { value: 'salary', label: '연봉 순' },
            ]}
          />
        </div>
      </div>
      {filter === 'P' && (
        <div className="ui-scope ui-role-chips" role="group" aria-label="투수 보직 필터">
          <button
            aria-pressed={role === 'all'}
            className={`ui-chip ${role === 'all' ? 'active' : ''}`}
            onClick={() => setRole('all')}
          >
            전체 투수 <b>{pitchers.length}</b>
          </button>
          {roleFilters.map((r) => (
            <button
              key={r}
              aria-pressed={role === r}
              className={`ui-chip ui-chip-${r} ${role === r ? 'active' : ''}`}
              onClick={() => setRole(r)}
            >
              {roleNames[r]} <b>{roleCount(r)}</b>
            </button>
          ))}
        </div>
      )}
      <div className="growth-filter" role="group" aria-label="성장 단계 필터">
        {[
          ['all', '모든 단계'],
          ['improving', '↗ 최근 상승'],
          ['declining', '↘ 최근 하락'],
          ...Object.entries(growthLabels),
        ].map(([key, label]) => (
          <button key={key} aria-pressed={growth === key} onClick={() => setGrowth(key)}>
            {label}
            {key !== 'all' && ` ${g.roster.filter((p) => matchesGrowth(p, key)).length}`}
          </button>
        ))}
      </div>
      <PlayerTable
        players={list}
        onPlayer={onPlayer}
        g={g}
        compact={!detailed}
        onMove={moves.move}
        busy={busy}
      />
      {moves.dialog}
      {!list.length && <Empty text="조건에 맞는 선수가 없습니다." />}
      <div className="panel-foot">
        {list.length}명 · 실명 {list.filter((p) => p.real).length}명 / 가상{' '}
        {list.filter((p) => !p.real).length}명
        <span>
          {filter === 'P'
            ? '보직 변경: 선수 상세 또는 전술 · 타순 화면'
            : 'OVR: 2025 공식 성적 기반 · * 적은 표본 · 잠재력은 추정'}
        </span>
      </div>
    </section>
  );
}
