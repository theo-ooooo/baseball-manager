'use client';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { gameDate } from '@dugout/shared/calendar';
import type { GameState } from '@dugout/shared/types';
import {
  isUnemployed,
  managerJobOpen,
  MANAGER_APPLICATION_THRESHOLD,
} from '@dugout/shared/manager-career';
import { useWorld } from './world-context';
import { Badge, Choice, SearchBox } from '../../components/game-ui';
import { ManagerApplication } from './manager-application';
import type { Act } from './game-contracts';
const stability = (confidence: number) =>
  confidence < 15
    ? ['매우 불안정', '#cf4d4d']
    : confidence < 35
      ? ['불안정', '#d58435']
      : confidence < 60
        ? ['안정적', '#758798']
        : confidence < 80
          ? ['확고함', '#329276']
          : ['절대적 신임', '#3d79b5'];
export function ManagerJobsPanel({
  g,
  act,
  busy,
  security = false,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  security?: boolean;
}) {
  const { leagues, getClub, standings } = useWorld();
  const [league, setLeague] = useState('all'),
    [filter, setFilter] = useState(security ? 'all' : 'open'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string | null>(null);
  const all = Object.values(g.managerJobs || {}),
    employed = !isUnemployed(g);
  const jobs = all
    .filter((job) => {
      const club = getClub(job.club);
      return (
        (league === 'all' || club.league === league) &&
        (filter === 'all' || (filter === 'vacant' ? job.vacant : managerJobOpen(job))) &&
        `${club.name} ${job.managerName}`.toLowerCase().includes(query.toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        Number(b.vacant) - Number(a.vacant) ||
        a.confidence - b.confidence ||
        a.club.localeCompare(b.club),
    );
  const tables = new Map(leagues.map((l) => [l.id, standings(g, l.id)]));
  return (
    <div className="job-market">
      <header className="job-market-heading">
        <div>
          <h2>{security ? '감독들의 직업 안정성' : '새로운 도전을 찾아서'}</h2>
          <p>
            {security
              ? '이사회가 보내는 신뢰와 흔들리는 감독 자리를 확인하세요.'
              : '공석과 입지가 불안한 구단을 살펴보고, 관심 있는 팀과 이야기를 시작하세요.'}
            {employed
              ? ' 현재 감독직을 유지하며 지원할 수 있습니다.'
              : ' 구단이 먼저 연락하면 수신함으로 제의가 도착합니다.'}
          </p>
        </div>
        <div className="job-market-counts">
          <div>
            <strong>{all.filter((j) => j.vacant).length}</strong>
            <small>감독 공석</small>
          </div>
          <div>
            <strong>{all.filter((j) => !j.vacant && j.confidence < 35).length}</strong>
            <small>입지 불안</small>
          </div>
          <div>
            <strong>
              {g.managerCareer?.offers.filter((o) =>
                ['invited', 'pending', 'interview', 'offered'].includes(o.status),
              ).length || 0}
            </strong>
            <small>진행 중인 대화</small>
          </div>
        </div>
      </header>
      <section className="panel">
        <div className="job-market-toolbar">
          <Choice
            label="채용 리그"
            value={league}
            onChange={setLeague}
            items={[
              { value: 'all', label: '전 세계 리그' },
              ...leagues.map((l) => ({ value: l.id, label: `${l.flag} ${l.name}` })),
            ]}
          />
          <Choice
            label="자리 상태"
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'open', label: '지원 가능한 구단' },
              { value: 'vacant', label: '감독 공석' },
              { value: 'all', label: '모든 구단' },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="구단 또는 감독 검색" />
        </div>
        <div className="job-table-scroll">
          <table className="job-market-table">
            <thead>
              <tr>
                <th scope="col">구단</th>
                <th scope="col">현 감독</th>
                <th scope="col">직업 안정성</th>
                <th scope="col">시즌 성적</th>
                <th scope="col">접촉</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const c = getClub(job.club),
                  l = leagues.find((l) => l.id === c.league)!,
                  table = tables.get(c.league)!,
                  rank = table.findIndex((s) => s.club === c.id) + 1,
                  row = table[rank - 1];
                const own = employed && c.id === g.club,
                  offer = g.managerCareer?.offers.find(
                    (o) =>
                      o.club === c.id &&
                      ['invited', 'pending', 'interview', 'offered'].includes(o.status) &&
                      o.expires >= gameDate(g),
                  ),
                  [status, tone] = stability(job.confidence);
                return (
                  <tr key={c.id} data-own={own} style={{ '--job-tone': tone } as CSSProperties}>
                    <td>
                      <div className="job-club-cell">
                        <Badge club={c} size="small" />
                        <div>
                          <strong>
                            <Link href={`/clubs/${encodeURIComponent(c.id)}`}>{c.name}</Link>
                            {own && <span className="job-current-club">내 구단</span>}
                          </strong>
                          <small>
                            {l.flag} {l.name}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="job-manager-cell">
                      <span>{job.vacant ? '—' : job.managerName}</span>
                      <small>{job.vacant ? '선임 절차 진행 중' : `${job.appointed} 취임`}</small>
                    </td>
                    <td>
                      {job.vacant ? (
                        <span className="job-vacant">감독 공석</span>
                      ) : (
                        <div className="job-confidence" title={job.reason}>
                          <div>
                            <b>
                              <i className="job-state-dot" />
                              {status}
                            </b>
                            <small>{job.confidence}%</small>
                          </div>
                          <div
                            className="confidence-track"
                            role="meter"
                            aria-label={`${c.name} 이사회 신임도`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={job.confidence}
                          >
                            <span style={{ width: `${job.confidence}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="job-record">
                      {row && row.w + row.l + row.d > 0 ? `${rank}위` : '시즌 준비'}
                      <small>
                        {row ? `${row.w}승 ${row.l}패${row.d ? ` ${row.d}무` : ''}` : '—'}
                      </small>
                    </td>
                    <td>
                      <div className="job-row-action">
                        {offer ? (
                          <Link className="button secondary compact" href="/manager/offers">
                            {offer.status === 'pending' ? '심사 중' : '연락 확인'}
                            <ArrowUpRight size={13} />
                          </Link>
                        ) : own ? (
                          <span className="muted">재직 중</span>
                        ) : managerJobOpen(job) ? (
                          <button
                            className="button secondary compact"
                            disabled={busy}
                            onClick={() => setSelected(c.id)}
                          >
                            관심 전하기
                            <ArrowUpRight size={13} />
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!jobs.length && (
          <div className="job-market-empty">
            <h3>조건에 맞는 구단이 없습니다</h3>
            <p>
              다른 리그나 자리 상태를 선택해 보세요. 날짜가 흐르면 새 공석과 구단의 연락이 생깁니다.
            </p>
          </div>
        )}
      </section>
      <footer className="job-market-legend">
        <span>{jobs.length}개 구단 · 이 세이브 안의 이사회 평가</span>
        <span>
          공석 또는 신임도 {MANAGER_APPLICATION_THRESHOLD}% 미만이면 지원 가능 · 실제 감독의 현실
          평가와 무관
        </span>
      </footer>
      {selected && (
        <ManagerApplication
          g={g}
          clubId={selected}
          act={act}
          busy={busy}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}
