'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type GameState, type Player, overall } from '@dugout/shared/game-view';
import { Choice, SearchBox, Empty } from '../../components/game-ui';
import { PlayerTable } from '../players/player-table';

export function Squad({ g, onPlayer }: { g: GameState; onPlayer: (p: Player) => void }) {
  const [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('rating'),
    [detailed, setDetailed] = useState(false);
  const list = g.roster
    .filter(
      (p) =>
        (filter === 'all' || p.pos === filter || (filter === 'young' && p.age <= 23)) &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'age'
        ? a.age - b.age
        : sort === 'salary'
          ? b.salary - a.salary
          : overall(b) - overall(a),
    );
  return (
    <section className="panel">
      <div className="toolbar">
        <Tabs value={filter} onValueChange={setFilter}>
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
              { value: 'age', label: '어린 선수 순' },
              { value: 'salary', label: '연봉 순' },
            ]}
          />
        </div>
      </div>
      <PlayerTable players={list} onPlayer={onPlayer} g={g} compact={!detailed} />
      {!list.length && <Empty text="조건에 맞는 선수가 없습니다." />}
      <div className="panel-foot">
        {list.length}명 · 실명 {list.filter((p) => p.real).length}명 / 가상{' '}
        {list.filter((p) => !p.real).length}명
        <span>OVR: 2025 공식 성적 기반 · * 적은 표본 · 잠재력은 추정</span>
      </div>
    </section>
  );
}
