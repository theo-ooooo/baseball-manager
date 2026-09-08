'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { GameState, Player } from '@dugout/shared/types';
import { firstTeam, reserveTeam, dayLabel } from '@dugout/shared/management';
import { FIRST_TEAM_LIMIT } from '@dugout/shared/roster-rules';
import { overall, blankStats } from '@dugout/shared/game-view';
import { PlayerName, Rating, SearchBox, positions } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { PositionTraining } from './management-panels';
import { assignmentLabel } from './pitching-panel';
import { useRosterMoves } from './roster-moves';

type Props = { g: GameState; act: Act; busy: boolean; onPlayer: (p: Player) => void };

export function ReservePanel({ g, act, busy, onPlayer }: Props) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('all');
  const [mobileSquad, setMobileSquad] = useState('reserve');
  const moves = useRosterMoves({ g, act, busy });
  const active = firstTeam(g),
    reserve = reserveTeam(g);
  const visible = (list: Player[]) =>
    list
      .filter((p) => (position === 'all' || p.pos === position) && p.name.includes(query))
      .sort((a, b) => overall(b) - overall(a));
  return (
    <div className="roster-manager">
      <div className="roster-overview">
        <div>
          <span>1군 등록</span>
          <strong>
            {active.length}
            <small> / {FIRST_TEAM_LIMIT}</small>
          </strong>
        </div>
        <div>
          <span>2군 선수</span>
          <strong>
            {reserve.length}
            <small>명</small>
          </strong>
        </div>
        <p>
          {active.length >= FIRST_TEAM_LIMIT
            ? '1군이 가득 찼어도 바로 교체할 수 있습니다.'
            : `1군에 ${FIRST_TEAM_LIMIT - active.length}명 더 등록할 수 있습니다.`}
        </p>
      </div>
      <Tabs defaultValue="roster">
        <TabsList variant="line" aria-label="1군 2군 관리 화면">
          <TabsTrigger value="roster">등록 관리</TabsTrigger>
          <TabsTrigger value="development">2군 훈련 · 기록</TabsTrigger>
        </TabsList>
        <TabsContent value="roster">
          <div className="roster-toolbar">
            <SearchBox value={query} onChange={setQuery} />
            <div className="roster-position-filter" role="group" aria-label="등록 선수 포지션 필터">
              {[['all', '전체'], ...Object.entries(positions)].map(([id, label]) => (
                <button key={id} aria-pressed={position === id} onClick={() => setPosition(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="roster-mobile-switch" role="group" aria-label="볼 선수단 선택">
            <button aria-pressed={mobileSquad === 'first'} onClick={() => setMobileSquad('first')}>
              1군 <b>{active.length}</b>
            </button>
            <button
              aria-pressed={mobileSquad === 'reserve'}
              onClick={() => setMobileSquad('reserve')}
            >
              2군 <b>{reserve.length}</b>
            </button>
          </div>
          <div className="roster-columns" data-mobile-squad={mobileSquad}>
            {[
              { title: '1군', subtitle: '경기에 출전하는 선수', squad: active, first: true },
              { title: '2군', subtitle: '육성과 회복이 필요한 선수', squad: reserve, first: false },
            ].map((group) => (
              <section
                className="roster-column"
                data-squad={group.first ? 'first' : 'reserve'}
                key={group.title}
                aria-label={`${group.title} 선수 명단`}
              >
                <header>
                  <div>
                    <h2>
                      {group.title}
                      <span>{group.squad.length}</span>
                    </h2>
                    <p>{group.subtitle}</p>
                  </div>
                  <small>{group.first ? '등록 · 말소' : '승격 · 육성'}</small>
                </header>
                <div className="roster-column-legend">
                  <span>선수 / 보직</span>
                  <span>능력 · 체력</span>
                  <span>이동</span>
                </div>
                <ul className="roster-list">
                  {visible(group.squad).map((p) => (
                    <li key={p.id}>
                      <div className="roster-identity">
                        <PlayerName p={p} onClick={onPlayer} />
                        <small>
                          {assignmentLabel(g, p) ||
                            (g.lineup.includes(p.id)
                              ? `${g.lineup.indexOf(p.id) + 1}번 타자`
                              : group.first
                                ? '벤치'
                                : '2군')}
                        </small>
                      </div>
                      <div className="roster-rating">
                        <Rating value={overall(p)} player={p} />
                        <span className={p.condition < 70 ? 'roster-tired' : ''}>
                          {Math.round(p.condition)}%
                        </span>
                      </div>
                      <div className="roster-actions">
                        <button
                          className="roster-move"
                          disabled={busy}
                          aria-label={`${p.name} ${group.first ? '2군 이동' : '1군 등록'}`}
                          onClick={() => void moves.move(p)}
                        >
                          {group.first ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                          {group.first ? '2군' : '1군'}
                        </button>
                        {group.first && (
                          <button
                            className="roster-swap"
                            disabled={busy}
                            aria-label={`${p.name} 교체 선수 선택`}
                            onClick={() => moves.exchange(p)}
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {!visible(group.squad).length && (
                    <li className="roster-empty">조건에 맞는 선수가 없습니다.</li>
                  )}
                </ul>
              </section>
            ))}
          </div>
          <p className="roster-footnote">
            이동 버튼으로 바로 등록하거나 말소합니다. 정원이나 포지션 최소 인원에 걸리면 교체 선수를
            선택할 수 있습니다.
          </p>
        </TabsContent>
        <TabsContent value="development">
          <ReserveDevelopment {...{ g, act, busy, onPlayer }} />
        </TabsContent>
      </Tabs>
      {moves.dialog}
    </div>
  );
}

function ReserveDevelopment({ g, act, busy, onPlayer }: Props) {
  const { getClub } = useWorld();
  const r = g.reserve;
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>2군 훈련 · 성적</h2>
          <span>
            {r?.w || 0}승 {r?.l || 0}패 {r?.d || 0}무
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>선수</th>
                <th>출전</th>
                <th>AVG / ERA</th>
                <th>개인 훈련</th>
              </tr>
            </thead>
            <tbody>
              {reserveTeam(g).map((p) => {
                const s = p.reserveStats || blankStats();
                return (
                  <tr key={p.id}>
                    <td>
                      <button className="text-button" onClick={() => onPlayer(p)}>
                        {p.name}
                      </button>
                      <small>{positions[p.pos]}</small>
                    </td>
                    <td>{s.g}경기</td>
                    <td>
                      {p.pos === 'P'
                        ? s.outs
                          ? ((s.er * 27) / s.outs).toFixed(2)
                          : '–'
                        : s.ab
                          ? (s.h / s.ab).toFixed(3)
                          : '–'}
                    </td>
                    <td>
                      <PositionTraining p={p} act={act} busy={busy} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="panel-content tiny">
          2군 경기는 별도 육성 일정이며 실제 퓨처스·마이너리그 규정과는 다릅니다. 타자 9명과 투수가
          필요하며 출전한 유망주는 코치 지도에 따라 성장합니다.
        </p>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>최근 2군 경기</h2>
        </div>
        {r?.history.length ? (
          r.history.slice(0, 12).map((m) => (
            <div className="reserve-result" key={m.day}>
              <span>{dayLabel(m.day)}</span>
              <strong>{getClub(g.club).short} 2군</strong>
              <b>
                {m.own} : {m.against}
              </b>
              <strong>{getClub(m.opponent).short} 2군</strong>
              <small>{m.played.length}명 출전</small>
            </div>
          ))
        ) : (
          <p className="panel-content muted">날짜를 진행하면 2군 경기 기록이 쌓입니다.</p>
        )}
      </section>
    </>
  );
}
