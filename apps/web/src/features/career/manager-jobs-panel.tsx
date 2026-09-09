'use client';
import Link from 'next/link';
import { useState } from 'react';
import { gameDate } from '@dugout/shared/calendar';
import type { GameState } from '@dugout/shared/types';
import {
  isUnemployed,
  managerJobOpen,
  MANAGER_APPLICATION_THRESHOLD,
} from '@dugout/shared/manager-career';
import { useWorld } from './world-context';
import { Choice, SearchBox } from '../../components/game-ui';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { Act } from './game-contracts';

export function ManagerJobsPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { clubs, leagues, getClub, standings, fixtures } = useWorld();
  const [league, setLeague] = useState('all'),
    [filter, setFilter] = useState('open'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [target, setTarget] = useState(1);
  const jobs = Object.values(g.managerJobs || {})
    .filter((job) => {
      const c = getClub(job.club);
      return (
        (league === 'all' || c.league === league) &&
        (filter === 'all' || managerJobOpen(job)) &&
        `${c.name} ${job.managerName}`.toLowerCase().includes(query.toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        Number(b.vacant) - Number(a.vacant) ||
        a.confidence - b.confidence ||
        a.club.localeCompare(b.club),
    );
  const chosen = selected ? g.managerJobs?.[selected] : undefined;
  const completedLeagues = new Set(
    leagues
      .filter((l) => {
        const last = fixtures(g, l.id).at(-1);
        return last && last.date < gameDate(g);
      })
      .map((l) => l.id),
  );
  const max = selected
    ? Math.ceil(clubs.filter((c) => c.league === getClub(selected).league).length * 0.75)
    : 1;
  return (
    <div className="manager-office">
      <section className="panel panel-content">
        <h2>감독 채용 현황</h2>
        <p>
          공석 또는 구단주 신임도 {MANAGER_APPLICATION_THRESHOLD}% 미만인 구단에 지원할 수 있습니다.
          신임도는 낮을수록 현 감독과 구단주의 관계가 나쁩니다. 수치와 채용 상태는 이 세이브 안의
          게임 평가입니다.
        </p>
        <div className="manager-form">
          <Choice
            label="채용 리그"
            value={league}
            onChange={setLeague}
            items={[
              { value: 'all', label: '전 세계 리그' },
              ...leagues.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <Choice
            label="자리 상태"
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'open', label: '지원 가능한 자리' },
              { value: 'all', label: '모든 구단' },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="구단·감독 검색" />
        </div>
        {!isUnemployed(g) && (
          <p>현재 재직 중입니다. 신임도와 공석을 살펴보고, 퇴임 후 지원할 수 있습니다.</p>
        )}
      </section>
      <section className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구단 · 리그</TableHead>
              <TableHead>현 감독</TableHead>
              <TableHead>구단주 신임도</TableHead>
              <TableHead>자리 상태</TableHead>
              <TableHead>순위</TableHead>
              <TableHead>지원</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const c = getClub(job.club),
                offer = g.managerCareer?.offers.find(
                  (o) => o.club === c.id && ['pending', 'offered'].includes(o.status),
                );
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <strong>{c.name}</strong>
                    <small className="block muted">
                      {leagues.find((l) => l.id === c.league)?.name}
                      {completedLeagues.has(c.league) ? ' · 정규시즌 종료' : ''}
                    </small>
                  </TableCell>
                  <TableCell>{job.managerName}</TableCell>
                  <TableCell>
                    {job.vacant ? '—' : `${job.confidence}%`}
                    <small className="block muted">{job.reason}</small>
                  </TableCell>
                  <TableCell>
                    {job.vacant
                      ? '공석'
                      : managerJobOpen(job)
                        ? '입지 불안 · 지원 가능'
                        : '재직 중'}
                  </TableCell>
                  <TableCell>
                    {standings(g, c.league).findIndex((s) => s.club === c.id) + 1}위
                  </TableCell>
                  <TableCell>
                    {offer?.status === 'offered' ? (
                      <Link className="button primary compact" href="/?view=manager">
                        제안 확인 · 계약
                      </Link>
                    ) : (
                      <button
                        className="button secondary compact"
                        disabled={busy || !isUnemployed(g) || !managerJobOpen(job) || !!offer}
                        onClick={() => {
                          setSelected(c.id);
                          setTarget(
                            Math.ceil(clubs.filter((x) => x.league === c.league).length / 2),
                          );
                        }}
                      >
                        {offer
                          ? offer.status === 'pending'
                            ? '심사 중'
                            : '제안 도착'
                          : '지원 조건 선택'}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!jobs.length && (
          <p className="panel-content">
            조건에 맞는 자리가 없습니다. 다른 리그나 모든 구단을 확인하세요.
          </p>
        )}
      </section>
      {chosen && (
        <section className="panel panel-content">
          <h2>{getClub(chosen.club).name} · 감독직 지원</h2>
          <p>
            감독 평판과 채용 상태를 심사해 3일 뒤 답변합니다. 지원만으로 현 감독이 교체되지는
            않습니다.
          </p>
          {completedLeagues.has(getClub(chosen.club).league) && (
            <p>
              정규시즌이 끝난 구단입니다. 취임 후 남은 월드 일정을 진행하고 다음 시즌부터 목표
              평가를 받습니다.
            </p>
          )}
          <div className="manager-form">
            <Choice
              label="지원 순위 목표"
              value={String(target)}
              onChange={(v) => setTarget(Number(v))}
              items={Array.from({ length: max }, (_, i) => ({
                value: String(i + 1),
                label: `${i + 1}위 이내`,
              }))}
            />
            <button
              className="button primary"
              disabled={busy || !managerJobOpen(chosen)}
              onClick={async () => {
                if (await act({ type: 'applyManager', club: chosen.club, targetRank: target }))
                  setSelected(null);
              }}
            >
              지원서 제출
            </button>
            <button className="button secondary" onClick={() => setSelected(null)}>
              닫기
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
