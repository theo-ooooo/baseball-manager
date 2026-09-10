'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Globe2 } from 'lucide-react';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, overall, money } from '@dugout/shared/game-view';
import { transfersBlocked } from '@dugout/shared/management';
import { Choice, SearchBox, Empty, positions } from '../../components/game-ui';
import { PlayerTable } from '../players/player-table';

export function Market({ g, onPlayer }: { g: GameState; onPlayer: (p: Player) => void }) {
  const { leagues, getClub, marketPlayers } = useWorld();
  const [query, setQuery] = useState(''),
    [lid, setLid] = useState('all'),
    [pos, setPos] = useState('all'),
    [kind, setKind] = useState('all'),
    [page, setPage] = useState(0),
    [sort, setSort] = useState('rating');
  const market = useMemo(() => marketPlayers(g), [g, marketPlayers]);
  const list = useMemo(
    () =>
      market
        .filter(
          (p) =>
            (lid === 'all' ||
              (lid === 'fa' && p.club === 'fa') ||
              getClub(p.club)?.league === lid) &&
            (pos === 'all' || p.pos === pos) &&
            (kind === 'all' || (kind === 'real' && p.real) || (kind === 'generated' && !p.real)) &&
            `${p.name} ${p.original}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'value'
            ? a.salary - b.salary
            : sort === 'potential' && g.rules?.revealPotential
              ? b.potential - a.potential
              : overall(b) - overall(a),
        ),
    [market, lid, pos, kind, query, sort, g.rules?.revealPotential, getClub],
  );
  const pages = Math.max(1, Math.ceil(list.length / 25));
  const current = Math.min(page, pages - 1);
  return (
    <>
      {transfersBlocked(g) && (
        <div className="rule-notice">
          첫 시즌 영입 금지 · {g.rules!.startYear + 1}년부터 외부 선수와 FA를 영입할 수 있습니다.
        </div>
      )}
      <div className="market-notice">
        <Globe2 size={24} />
        <div>
          <strong>선수 검색 · 영입 현황</strong>
          <p>
            {market.filter((p) => p.real).length.toLocaleString()}명의 실명 선수와{' '}
            {market.filter((p) => !p.real).length.toLocaleString()}명의 가상 선수 · 계약 선수는
            트레이드, FA는 직접 협상
          </p>
        </div>
        <div>
          <span className="label">사용 가능한 예산</span>
          <strong className="accent">{money(g.budget)}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="market-filters">
          <SearchBox
            value={query}
            onChange={(s) => {
              setQuery(s);
              setPage(0);
            }}
            placeholder="선수 이름 검색 · 오타니, 저지, 김도영"
          />
          <Choice
            label="리그 필터"
            value={lid}
            onChange={(v) => {
              setLid(v);
              setPage(0);
            }}
            items={[
              { value: 'all', label: '전 세계 리그' },
              { value: 'fa', label: 'FA · 자유계약' },
              ...leagues.map((l) => ({ value: l.id, label: `${l.flag} ${l.name}` })),
            ]}
          />
          <Choice
            label="포지션 필터"
            value={pos}
            onChange={(v) => {
              setPos(v);
              setPage(0);
            }}
            items={[
              { value: 'all', label: '모든 포지션' },
              ...Object.entries(positions).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Choice
            label="선수 유형"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(0);
            }}
            items={[
              { value: 'all', label: '실명 + 가상' },
              { value: 'real', label: '실명 선수' },
              { value: 'generated', label: '가상 선수' },
            ]}
          />
          <Choice
            label="시장 정렬"
            value={sort}
            onChange={setSort}
            items={[
              { value: 'rating', label: '능력치 높은 순' },
              ...(g.rules?.revealPotential
                ? [{ value: 'potential', label: '잠재력 높은 순' }]
                : []),
              { value: 'value', label: '연봉 낮은 순' },
            ]}
          />
        </div>
        <PlayerTable
          players={list.slice(current * 25, (current + 1) * 25)}
          g={g}
          onPlayer={onPlayer}
          kind="market"
        />
        {!list.length && <Empty text="검색 조건에 맞는 선수가 없습니다." />}
        <div className="pagination">
          <span>
            {list.length.toLocaleString()}명 중 {list.length ? current * 25 + 1 : 0}–
            {Math.min((current + 1) * 25, list.length)}
          </span>
          <div>
            <button
              aria-label="이전 페이지"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              aria-label="다음 페이지"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
