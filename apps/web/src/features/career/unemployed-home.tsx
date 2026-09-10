'use client';
import Link from 'next/link';
import { UserRound, ArrowRight } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import { managerJobOpen } from '@dugout/shared/manager-career';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import { managerOfferActionLabel } from './manager-offer-status';

export function UnemployedHome({
  g,
  busy,
  onContinue,
  continueLabel,
}: {
  g: GameState;
  busy: boolean;
  onContinue: () => void;
  continueLabel: string;
}) {
  const { getClub } = useWorld();
  const m = g.managerCareer!,
    active = m.offers.filter(
      (o) =>
        ['invited', 'interview', 'pending', 'offered'].includes(o.status) &&
        o.expires >= gameDate(g),
    );
  const vacancies = Object.values(g.managerJobs || {}).filter(managerJobOpen).length;
  return (
    <div className="unemployed-home">
      <header className="panel unemployed-welcome">
        <span className="unemployed-avatar">
          <UserRound size={30} />
        </span>
        <div>
          <small>MANAGER HOME</small>
          <h1>{g.manager} 감독의 다음 도전</h1>
          <p>
            소속 없음 · 무직{' '}
            {Math.max(0, daysBetween(m.unemployedSince || gameDate(g), gameDate(g)))}일째
          </p>
        </div>
        <button className="button primary" disabled={busy} onClick={onContinue}>
          {continueLabel}
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="unemployed-home-grid">
        <section className="panel panel-content">
          <h2>
            받은 면접 · 계약 제안 <span>{active.length}</span>
          </h2>
          {active.length ? (
            active.map((o) => (
              <Link
                className="unemployed-contact"
                key={o.id}
                href={`/interviews/${encodeURIComponent(o.id)}`}
              >
                <strong>{getClub(o.club).name}</strong>
                <span>
                  {managerOfferActionLabel(o, g)}
                  <ArrowRight size={15} />
                </span>
              </Link>
            ))
          ) : (
            <p>
              아직 진행 중인 제안이 없습니다. 관심 있는 구단에 지원하거나 날짜를 진행해 새 연락을
              기다려 보세요.
            </p>
          )}
          <Link className="text-button" href="/manager/offers">
            받은 제안 모두 보기 →
          </Link>
        </section>
        <section className="panel panel-content">
          <h2>새 직장 찾기</h2>
          <p>
            현재 지원 가능한 구단 <strong>{vacancies}개</strong>
          </p>
          <p>공석과 감독의 직업 안정성을 살펴보고 관심 있는 구단에 지원하세요.</p>
          <Link className="button secondary" href="/?view=jobs">
            채용 센터
          </Link>
        </section>
      </div>
      <section className="panel panel-content">
        <h2>최근 소식</h2>
        {g.news.slice(0, 6).map((n) => (
          <Link
            className="unemployed-contact"
            key={n.id}
            href={`/?view=inbox&report=${encodeURIComponent(n.id)}`}
          >
            <strong>{n.title}</strong>
            <span>
              {n.read ? '읽음' : '새 소식'}
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
        <Link className="text-button" href="/?view=inbox">
          수신함 열기 →
        </Link>
      </section>
    </div>
  );
}
