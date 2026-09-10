'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { inningsLabel, leaderValueLabel, plateAppearances } from '@dugout/shared/player-leaders';
import { useWorld } from '../career/world-context';
import { usePlayerLeaders } from './use-player-leaders';

export function PlayerLeaderboard({
  g,
  league,
  onPlayer,
}: {
  g: GameState;
  league: string;
  onPlayer: (p: Player) => void;
}) {
  const { getClub, getLeague } = useWorld();
  const m = usePlayerLeaders(g, league);
  const rate = m.metric === 'avg' || m.metric === 'era';
  const metricName = m.metrics.find((x) => x.id === m.metric)!.label;
  return (
    <section className="panel league-records" aria-labelledby="player-leaders-title">
      <header className="league-records-header">
        <div>
          <span className="league-records-eyebrow">
            {g.year} · {getLeague(league).name} · 현재 시즌
          </span>
          <h2 id="player-leaders-title">
            <Trophy size={20} /> 선수 기록 순위
          </h2>
        </div>
        <div className="league-record-switch" aria-label="선수 기록 유형">
          <button aria-pressed={m.kind === 'batting'} onClick={() => m.selectKind('batting')}>
            타자
          </button>
          <button aria-pressed={m.kind === 'pitching'} onClick={() => m.selectKind('pitching')}>
            투수
          </button>
        </div>
      </header>
      <div className="league-record-metrics" aria-label="순위 항목">
        {m.metrics.map((metric) => (
          <button
            key={metric.id}
            aria-pressed={m.metric === metric.id}
            onClick={() => m.selectMetric(metric.id)}
          >
            {metric.label}
          </button>
        ))}
      </div>
      <div className="league-record-filter">
        <span>
          {metricName} 순위 · {m.total}명
        </span>
        {rate && (
          <label>
            <input
              type="checkbox"
              checked={m.qualifiedOnly}
              onChange={(e) => m.selectQualified(e.target.checked)}
            />
            규정 {m.kind === 'batting' ? '타석' : '이닝'} 충족 선수만
          </label>
        )}
      </div>
      <table className="league-record-table">
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">선수 · 구단</th>
            <th scope="col">{metricName}</th>
            <th scope="col" className="record-secondary">
              경기
            </th>
            <th scope="col" className="record-secondary">
              {m.kind === 'batting' ? '타석' : '이닝'}
            </th>
            <th scope="col" className="record-secondary">
              {m.kind === 'batting' ? '안타 / 타수' : '자책점'}
            </th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map(({ player: p, rank, qualified, required }) => (
            <tr
              key={p.id}
              className={
                p.club === g.club && g.managerCareer?.status !== 'unemployed' ? 'own' : undefined
              }
            >
              <td className="record-rank">{rank}</td>
              <td>
                <button className="record-player" onClick={() => onPlayer(p)}>
                  {p.name}
                </button>
                <div className="record-player-meta">
                  <Link href={`/clubs/${encodeURIComponent(p.club)}`}>{getClub(p.club).name}</Link>
                  <span>
                    {m.kind === 'batting'
                      ? `${plateAppearances(p)}타석`
                      : `${inningsLabel(p.stats.outs)}이닝`}
                  </span>
                  {rate && !qualified && (
                    <small
                      title={`기준 ${m.kind === 'batting' ? required + '타석' : inningsLabel(required) + '이닝'}`}
                    >
                      규정 미달
                    </small>
                  )}
                </div>
              </td>
              <td className="record-value">{leaderValueLabel(p, m.metric)}</td>
              <td className="record-secondary">{p.stats.g}</td>
              <td className="record-secondary">
                {m.kind === 'batting' ? plateAppearances(p) : inningsLabel(p.stats.outs)}
              </td>
              <td className="record-secondary">
                {m.kind === 'batting' ? `${p.stats.h} / ${p.stats.ab}` : p.stats.er}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!m.rows.length && (
        <div className="league-record-empty">
          <Trophy size={28} />
          <strong>
            {rate && m.qualifiedOnly
              ? '아직 규정을 충족한 선수가 없습니다'
              : '아직 집계된 선수 기록이 없습니다'}
          </strong>
          <p>
            {rate && m.qualifiedOnly
              ? '규정 필터를 해제하면 출전 기록이 있는 선수도 볼 수 있습니다.'
              : '경기를 진행하면 이곳에 선수별 순위가 쌓입니다.'}
          </p>
        </div>
      )}
      <footer className="league-record-footer">
        <p>게임 내 정규시즌 기록 · 현재 소속 구단 기준 · 타 구단 일반 경기는 간이 기록 집계</p>
        <div>
          <button aria-label="이전 선수 순위" disabled={m.currentPage === 0} onClick={m.previous}>
            <ChevronLeft size={16} />
          </button>
          <span>
            {m.currentPage + 1} / {m.totalPages}
          </span>
          <button
            aria-label="다음 선수 순위"
            disabled={m.currentPage + 1 === m.totalPages}
            onClick={m.next}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
      {rate && (
        <p className="league-record-note">
          게임 기준: 팀 경기 수 × 3.1타석(반올림), 팀 경기 수 × 1이닝. 타석은 현재 기록하는
          타수·볼넷·희생번트 합계이며, 각 리그의 수위 타자 예외 규정은 적용하지 않습니다.
        </p>
      )}
    </section>
  );
}
