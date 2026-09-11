import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import { CareerRecords, useRecords } from './career-records';
import { useWorld } from '../career/world-context';
export function RetiredPlayerProfile({ g, id }: { g: GameState; id: string }) {
  const { data, error } = useRecords(`/api/records/${encodeURIComponent(id)}`),
    { getClub } = useWorld();
  if (error)
    return (
      <section className="panel panel-content" role="alert">
        {error}
      </section>
    );
  if (!data)
    return (
      <section className="panel panel-content" role="status">
        인물의 경력 기록을 불러오는 중…
      </section>
    );
  const retirement = data.find((r) => r.kind === 'retirement'),
    person = retirement || data[0];
  if (!person)
    return (
      <section className="panel panel-content">
        <h2>보관된 인물 기록이 없습니다</h2>
        <Link href="/?view=records">기록 보관함으로 →</Link>
      </section>
    );
  const assigned =
    retirement?.coach &&
    (g.staff.find((c) => c.id === retirement.coach!.id) ||
      g.coachAssignments?.[retirement.coach.id]?.coach);
  return (
    <article className="person-profile">
      <header className="panel person-profile-header">
        <div className="person-monogram">{retirement ? '은퇴' : '경력'}</div>
        <div>
          <small>
            {person.country} · {person.pos}
          </small>
          <h1>{person.name}</h1>
          <p>
            {retirement ? `${retirement.year}년 현역 은퇴` : '보관된 선수 경력'} · 마지막 소속{' '}
            {getClub(person.club)?.name}
          </p>
          <span>
            {assigned
              ? `${assigned.role} 코치로 활동 중`
              : retirement
                ? '현역 활동 종료 · 경력 보관'
                : '과거 소속과 기록'}
          </span>
        </div>
      </header>
      {retirement?.coach && (
        <section className="dossier-card">
          <h3>{assigned ? '지도자 활동' : '은퇴 이후'}</h3>
          <p>
            {assigned
              ? '선수 시절 기록과 코치 경력을 이어서 확인할 수 있습니다.'
              : '현역에서 은퇴한 인물입니다. 코치로 전환하지 않아도 선수 경력은 계속 보관합니다.'}
          </p>
          <div className="person-profile-actions">
            <Link
              className="button secondary"
              href={`/coaches/${encodeURIComponent(retirement.coach.id)}`}
            >
              코치 능력 · 소속 확인 →
            </Link>
            {g.managerCareer?.status !== 'unemployed' && (
              <Link className="text-button" href="/?view=records">
                은퇴 선수 코치 영입 검토 →
              </Link>
            )}
          </div>
        </section>
      )}
      <CareerRecords playerId={id} year={g.year} />
    </article>
  );
}
