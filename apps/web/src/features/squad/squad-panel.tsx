'use client';
import Link from 'next/link';
import { SlidersHorizontal, ArrowRight, Activity, Users } from 'lucide-react';
import { type GameState, type Player } from '@dugout/shared/game-view';
import { SearchBox, Empty } from '../../components/game-ui';
import { PlayerTable } from '../players/player-table';
import { roleNames } from './pitching-panel';
import { useRosterMoves } from './roster-moves';
import { useSquadBrowser } from './use-squad-browser';
import type { Act } from '../career/game-contracts';
import { growthLabels } from '@dugout/shared/development';

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
  const moves = useRosterMoves({ g, act, busy }),
    s = useSquadBrowser(g);
  return (
    <div className="squad-workspace">
      <section className="panel squad-list-panel" aria-label="선수 명단">
        <header className="squad-list-heading">
          <div className="squad-scope" role="group" aria-label="볼 선수단">
            {(
              [
                ['all', '전체', g.roster.length],
                ['first', '1군', s.first],
                ['reserve', '2군', g.roster.length - s.first],
              ] as const
            ).map(([id, label, count]) => (
              <button key={id} aria-pressed={s.squad === id} onClick={() => s.setSquad(id)}>
                {label}
                <b>{count}</b>
              </button>
            ))}
          </div>
          <span>{s.list.length}명 표시</span>
        </header>
        <div className="squad-command-bar">
          <SearchBox value={s.query} onChange={s.setQuery} placeholder="선수 이름 검색" />
          <select
            aria-label="포지션"
            value={s.filter}
            onChange={(e) => s.setFilter(e.target.value)}
          >
            {[
              ['all', '모든 포지션'],
              ['P', '투수'],
              ['C', '포수'],
              ['IF', '내야수'],
              ['OF', '외야수'],
              ['DH', '지명타자'],
              ['young', '유망주'],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <details className="squad-filter-menu">
            <summary aria-label="선수 필터">
              <SlidersHorizontal size={16} />
              <span>필터</span>
              {(s.growth !== 'all' || s.condition !== 'all' || s.role !== 'all') && <i />}
            </summary>
            <div>
              <label>
                정렬
                <select value={s.sort} onChange={(e) => s.setSort(e.target.value)}>
                  {[
                    ['rating', '능력치 순'],
                    ['growth', '최근 성장량 순'],
                    ['age', '어린 선수 순'],
                    ['salary', '연봉 순'],
                  ].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                성장 단계
                <select value={s.growth} onChange={(e) => s.setGrowth(e.target.value)}>
                  {[
                    ['all', '모든 단계'],
                    ['improving', '최근 상승'],
                    ['declining', '최근 하락'],
                    ...Object.entries(growthLabels),
                  ].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                컨디션
                <select value={s.condition} onChange={(e) => s.setCondition(e.target.value)}>
                  <option value="all">전체</option>
                  <option value="tired">휴식 필요 · 70% 미만</option>
                </select>
              </label>
              {s.filter === 'P' && (
                <label>
                  투수 보직
                  <select value={s.role} onChange={(e) => s.setRole(e.target.value)}>
                    <option value="all">전체 보직</option>
                    {Object.entries(roleNames).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="squad-detail-check">
                <input
                  type="checkbox"
                  checked={s.detailed}
                  onChange={(e) => s.setDetailed(e.target.checked)}
                />
                상세 능력치 열 보기
              </label>
              <button className="text-button" onClick={s.reset}>
                필터 초기화
              </button>
            </div>
          </details>
        </div>
        {s.condition === 'tired' && (
          <div className="squad-applied-filter">
            휴식이 필요한 선수 <button onClick={() => s.setCondition('all')}>필터 해제 ×</button>
          </div>
        )}
        <PlayerTable
          players={s.list}
          onPlayer={onPlayer}
          g={g}
          compact={!s.detailed}
          onMove={moves.move}
          busy={busy}
        />
        {moves.dialog}
        {!s.list.length && <Empty text="조건에 맞는 선수가 없습니다." />}
        <div className="panel-foot">
          {s.list.length}명 · 선수를 누르면 전체 화면으로 상세 정보를 봅니다.
        </div>
      </section>
      <aside className="squad-desk" aria-label="선수단 업무">
        <header>
          <Users size={17} />
          <h2>선수단 현황</h2>
        </header>
        <dl>
          <div>
            <dt>1군 등록</dt>
            <dd>{s.first}명</dd>
          </div>
          <div>
            <dt>2군 선수</dt>
            <dd>{g.roster.length - s.first}명</dd>
          </div>
        </dl>
        <button
          className="squad-health-link"
          onClick={() => {
            s.setCondition('tired');
            s.setSquad('all');
          }}
        >
          <Activity size={17} />
          <span>
            회복이 필요한 선수<strong>{s.tired}명</strong>
          </span>
          <ArrowRight size={15} />
        </button>
        <p>
          등판 후 피로는 휴식으로 관리합니다. 등록·말소는 경기력과 대체 선수를 함께 보고 결정하세요.
        </p>
        <nav aria-label="선수단 업무 바로가기">
          <Link href="/?view=reserves">
            등록 · 말소 관리
            <ArrowRight size={15} />
          </Link>
          <Link href="/?view=registrations">
            어제 · 오늘 등록 공시
            <ArrowRight size={15} />
          </Link>
          <Link href="/?view=training">
            주간 훈련 계획
            <ArrowRight size={15} />
          </Link>
          <Link href="/?view=medical">
            부상 · 재활 관리
            <ArrowRight size={15} />
          </Link>
        </nav>
        {g.coachRecommendations?.some((r) => r.status === 'pending') && (
          <Link className="squad-coach-alert" href="/?view=reserves">
            검토할 코치 추천 {g.coachRecommendations.filter((r) => r.status === 'pending').length}건
            →
          </Link>
        )}
      </aside>
    </div>
  );
}
