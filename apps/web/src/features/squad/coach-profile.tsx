'use client';
import { useRecords } from '../players/career-records';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import { coachDirectory } from '@dugout/shared/coach-directory';
import { coachJudgment } from '@dugout/shared/coach-assessment';
import { abilityText } from '@dugout/shared/ratings';
import { money } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
export function CoachProfile({ g, id }: { g: GameState; id: string }) {
  const { coachPool, getClub } = useWorld();
  const records = useRecords(
    id.startsWith('retired-') ? `/api/records/${encodeURIComponent(id.slice(8))}` : null,
  );
  const retired = records.data?.find((r) => r.kind === 'retirement')?.coach;
  const entry =
    coachDirectory(g, coachPool(g.year)).find(({ coach }) => coach.id === id) ||
    (retired ? { coach: retired, club: 'fa' } : undefined);
  if (id.startsWith('retired-') && !entry && !records.error && !records.data)
    return <p role="status">은퇴 선수의 지도자 기록을 불러오는 중…</p>;
  if (!entry)
    return (
      <section className="panel">
        <h1>코치를 찾을 수 없습니다</h1>
        <p>검색창에서 코치 이름을 다시 찾아 주세요.</p>
      </section>
    );
  const { coach: c, club } = entry,
    judgment = coachJudgment(c);
  return (
    <article className="person-profile">
      <header className="panel person-profile-header">
        <div className="person-monogram" aria-hidden="true">
          코치
        </div>
        <div>
          <small>
            {c.real ? '실명 코치' : '가상 코치'} · {c.role}
          </small>
          <h1>{c.name}</h1>
          <p>
            {club === 'fa' ? (
              '무소속'
            ) : (
              <Link href={`/clubs/${encodeURIComponent(club)}`}>{getClub(club)?.name || club}</Link>
            )}
          </p>
        </div>
      </header>
      {id.startsWith('retired-') && (
        <Link className="button secondary" href={`/players/${encodeURIComponent(id.slice(8))}`}>
          선수 시절 기록 · 은퇴 인물 상세 →
        </Link>
      )}
      {c.managerPersonId && (
        <Link
          className="button secondary"
          href={`/managers/${encodeURIComponent(c.managerPersonId)}`}
        >
          감독 · 코치 경력과 성향 보기 →
        </Link>
      )}
      <section className="panel">
        <div className="panel-header">
          <h2>지도 능력</h2>
          <span>게임 능력치</span>
        </div>
        <div className="person-rating-grid">
          <div>
            <span>{c.role} 지도</span>
            <strong>
              {abilityText(c.skill)} <small>/ 100</small>
            </strong>
            <progress max={100} value={c.skill} aria-label="코치 지도 능력" />
            <p>담당 분야의 훈련 효과에 반영됩니다.</p>
          </div>
          <div>
            <span>선수 평가 · 기용 판단</span>
            <strong>{judgment.label}</strong>
            <p>능력이 높을수록 선수 평가 오차가 줄고 피로를 일찍 파악합니다.</p>
          </div>
          <div>
            <span>지도 스타일</span>
            <strong>{c.style}</strong>
            <p>{c.verifiedRole || `${c.role} 담당`}</p>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>소속과 계약</h2>
        </div>
        <dl className="profile-stat-grid">
          <div>
            <dt>현재 소속</dt>
            <dd>{club === 'fa' ? '무소속' : getClub(club)?.name}</dd>
          </div>
          <div>
            <dt>연봉</dt>
            <dd>{money(c.salary)}</dd>
          </div>
          <div>
            <dt>계약 기간</dt>
            <dd>
              {club === 'fa'
                ? '계약 없음'
                : c.contractUntil
                  ? `${c.contractUntil}시즌 전까지`
                  : '기간 기록 없음'}
            </dd>
          </div>
          <div>
            <dt>담당 분야</dt>
            <dd>{c.role}</dd>
          </div>
        </dl>
        {g.managerCareer?.status !== 'unemployed' && !g.managerCareer?.vacationUntil && (
          <Link className="button secondary" href="/?view=staff">
            스태프 · 영입 협상
          </Link>
        )}
      </section>
      {c.source && (
        <section className="panel">
          <h2>등록 자료</h2>
          <p className="person-profile-note">
            실명과 등록 소속은 원본 자료를 따르며 능력·연봉·담당 보직은 게임 설정입니다.
          </p>
          <a href={c.source} target="_blank" rel="noreferrer">
            원본 등록 자료 ↗
          </a>
        </section>
      )}
    </article>
  );
}
