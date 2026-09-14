'use client';
import { careerFetch } from '../career/career-slot';
import { useEffect, useState } from 'react';
import type { GameState, Player } from '@dugout/shared/types';
import type { PlayerCareerRecord } from '@dugout/shared/long-term';
import { statKeys, unpackStats } from '@dugout/shared/long-term';
import { coachRoles, money } from '@dugout/shared/game-view';
import { Choice, SearchBox } from '../../components/game-ui';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';

export function useRecords(path: string | null) {
  const [snapshot, setSnapshot] = useState<{
    path: string;
    data: PlayerCareerRecord[] | null;
    error: string;
  }>({ path: '', data: null, error: '' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    careerFetch(path, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('기록을 불러오지 못했습니다.');
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setSnapshot({ path, data, error: '' });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setSnapshot({ path, data: null, error: e.message });
      });
    return () => controller.abort();
  }, [path]);
  return snapshot.path === path ? snapshot : { data: null, error: '' };
}
export function CareerRecords({
  playerId,
  current,
  year,
}: {
  playerId: string;
  current?: Player;
  year: number;
}) {
  const { getClub } = useWorld();
  const { data, error } = useRecords(`/api/records/${encodeURIComponent(playerId)}`);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">시즌별 기록을 불러오는 중…</p>;
  const totals = unpackStats();
  const count = [
    ...data.filter((r) => !current || r.year < year).map((r) => r.stats),
    ...(current ? [current.stats] : []),
  ];
  for (const stats of count)
    for (const key of statKeys) totals[key] = (totals[key] || 0) + (stats[key] || 0);
  const pitcher = current?.pos === 'P' || data[0]?.pos === 'P';
  return (
    <section className="panel-content dossier-card career-record-card">
      <h3>게임 내 통산 기록 · 소속팀 이력</h3>
      <p>
        {totals.g}경기 ·{' '}
        {pitcher
          ? `${Math.floor(totals.outs / 3)}.${totals.outs % 3}이닝 · ${totals.wins}승 · ERA ${totals.outs ? ((totals.er * 27) / totals.outs).toFixed(2) : '—'}`
          : `${totals.h}안타 · ${totals.hr}홈런 · ${totals.rbi}타점 · AVG ${totals.ab ? (totals.h / totals.ab).toFixed(3) : '—'}`}
      </p>
      <p className="muted">
        이 세이브에서 기록 보관 기능을 사용한 이후의 성적입니다. 시즌 종료와 이적 시 소속팀별 기록을
        보관합니다.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>시즌</th>
              <th>소속팀</th>
              <th>구분</th>
              <th>경기</th>
              <th>{pitcher ? '이닝 · ERA' : '안타 · 홈런'}</th>
              <th>수상·이동</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>{r.year}</td>
                <td>{getClub(r.club)?.name || 'FA'}</td>
                <td>
                  {{ season: '시즌 종료', transfer: '구단 이동', retirement: '은퇴' }[r.kind]}
                </td>
                <td>{r.stats.g}</td>
                <td>
                  {pitcher
                    ? `${Math.floor(r.stats.outs / 3)}.${r.stats.outs % 3} · ${r.stats.outs ? ((r.stats.er * 27) / r.stats.outs).toFixed(2) : '—'}`
                    : `${r.stats.h} · ${r.stats.hr}`}
                </td>
                <td>
                  {r.awards.join(' · ')}
                  {r.destination && ` → ${getClub(r.destination)?.name || 'FA'}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <p>아직 보관된 시즌 기록이 없습니다.</p>}
    </section>
  );
}
export function RecordsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { marketPlayers, getClub } = useWorld();
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(''),
    [role, setRole] = useState('투수'),
    [offset, setOffset] = useState(0);
  const { data: retired, error } = useRecords(`/api/records/retired?offset=${offset}`);
  const active = [...g.roster, ...marketPlayers(g)];
  const current = active.find((p) => p.id === selected);
  const former = retired?.find((p) => p.playerId === selected);
  return (
    <div className="manager-office">
      <section className="panel panel-content">
        <h2>선수 기록 보관함</h2>
        <SearchBox value={query} onChange={setQuery} placeholder="현역 선수 이름 검색" />
        <div className="manager-form">
          {active
            .filter((p) => (query ? `${p.name} ${p.original}`.includes(query) : p.club === g.club))
            .slice(0, 40)
            .map((p) => (
              <button
                className="button secondary compact"
                key={p.id}
                onClick={() => setSelected(p.id)}
              >
                {p.name} · {getClub(p.club)?.short || 'FA'}
              </button>
            ))}
        </div>
      </section>
      <section className="panel panel-content">
        <h2>은퇴 선수 · 코치 후보</h2>
        {error && <p role="alert">{error}</p>}
        {retired?.map((r) => (
          <button
            className="button secondary compact"
            key={r.id}
            onClick={() => {
              setSelected(r.playerId);
              setRole(r.coach?.role || '투수');
            }}
          >
            {r.name} · {r.year}년 은퇴
          </button>
        ))}
        {retired?.length === 0 && (
          <p>은퇴한 선수가 없습니다. 시즌 종료 후 선수들의 은퇴와 코치 전환을 확인하세요.</p>
        )}
        <div className="manager-form">
          <button
            className="button secondary"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 150))}
          >
            이전
          </button>
          <button
            className="button secondary"
            disabled={!retired || retired.length < 150}
            onClick={() => setOffset(offset + 150)}
          >
            다음
          </button>
        </div>
      </section>
      {selected && (
        <section className="panel">
          <h2 className="panel-content">{current?.name || former?.name || '선수 기록'}</h2>
          <CareerRecords playerId={selected} current={current} year={g.year} />
          {former?.coach && g.managerCareer?.status !== 'unemployed' && (
            <div className="panel-content">
              <h3>은퇴 선수 코치 계약</h3>
              <p>
                지도력 {former.coach.skill} · 연봉 {money(former.coach.salary)} · 2년 계약. 같은
                보직의 기존 코치를 교체하면 연봉의 50%를 정산합니다.
              </p>
              <div className="manager-form">
                <Choice
                  label="담당 보직"
                  value={role}
                  onChange={setRole}
                  items={coachRoles.map((r) => ({ value: r, label: r }))}
                />
                <button
                  className="button primary"
                  disabled={busy || g.staff.some((c) => c.id === former.coach!.id)}
                  onClick={() => void act({ type: 'hireRetiredCoach', playerId: selected, role })}
                >
                  코치 계약 체결
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
