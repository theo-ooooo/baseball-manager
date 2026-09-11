'use client';
import Link from 'next/link';
import { playerPosition } from '@dugout/shared/management';
import { ratingText, ratingBasis } from '@dugout/shared/ratings';
import type { GameState } from '@dugout/shared/types';
import { useInternationalTeams } from './use-international-teams';

export function InternationalTeamsPanel({
  g,
  fixedCountry,
}: {
  g: GameState;
  fixedCountry?: string;
}) {
  const teams = useInternationalTeams(g, fixedCountry);
  return <InternationalTeamsContent teams={teams} fixedCountry={fixedCountry} />;
}
export function InternationalTeamsContent({
  teams,
  fixedCountry,
}: {
  teams: ReturnType<typeof useInternationalTeams>;
  fixedCountry?: string;
}) {
  const { event, selection, country, players } = teams;
  return (
    <section
      id="national-teams"
      className="panel international-teams"
      aria-label="나라별 국가대표 팀"
    >
      <div className="panel-header">
        <h2>{fixedCountry ? `${fixedCountry} 국가대표` : '나라별 국가대표 팀'}</h2>
        <span>게임 내 선발 명단</span>
      </div>
      <div className="international-team-controls">
        <label>
          대회
          <select value={event?.id || ''} onChange={(e) => teams.setEventId(e.target.value)}>
            {!teams.events.length && <option value="">대회 일정 없음</option>}
            {teams.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.start.slice(0, 4)} · {e.name}
              </option>
            ))}
          </select>
        </label>
        {!fixedCountry && (
          <label>
            국가
            <select value={country} onChange={(e) => teams.setCountry(e.target.value)}>
              {teams.countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <header className="international-team-heading">
        <h3>{country} 대표팀</h3>
        <span>
          {players.length}명 ·{' '}
          {selection?.stage === 'away'
            ? '대표팀 합류 중'
            : selection?.stage === 'returned'
              ? '구단 복귀'
              : selection
                ? '차출 예정'
                : '선발 명단 없음'}
        </span>
      </header>
      {event && (
        <p>
          합류 {event.departure} · 복귀 {event.returnDate}
        </p>
      )}
      {players.length ? (
        <div
          className="national-roster-scroll"
          role="region"
          aria-label={`${country} 대표팀 명단`}
          tabIndex={0}
        >
          <table className="national-roster-table">
            <caption className="sr-only">{country} 대표팀 선수의 소속 구단, 오버롤, 포지션</caption>
            <colgroup>
              <col className="national-name-col" />
              <col className="national-club-col" />
              <col className="national-rating-col" />
              <col className="national-position-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">선수</th>
                <th scope="col">소속 구단</th>
                <th scope="col">오버롤</th>
                <th scope="col">포지션</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <Link href={`/players/${encodeURIComponent(p.id)}`}>{p.name}</Link>
                  </th>
                  <td>
                    {p.club === 'fa' ? (
                      'FA'
                    ) : (
                      <Link href={`/clubs/${encodeURIComponent(p.club)}`}>
                        {teams.getClub(p.club)?.name || p.club}
                      </Link>
                    )}
                  </td>
                  <td>
                    <strong className="national-rating" title={ratingBasis(p)}>
                      {ratingText(p)}
                    </strong>
                  </td>
                  <td>
                    <span className="international-position">
                      {playerPosition(p).group}
                      {playerPosition(p).detail && <small>({playerPosition(p).detail})</small>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="international-empty">
          {!selection
            ? event
              ? `명단은 ${event.announce}부터 발표됩니다. 지난 대회에 대한 차출 기록이 없는 경우 명단을 만들지 않습니다.`
              : '현재 시즌에 편성된 국제대회가 없습니다.'
            : '이 대회에 선발된 해당 국가 선수가 없습니다. 출전 국가와 게임 내 선수 수·차출 조건에 따라 명단이 달라집니다.'}
        </p>
      )}
      <p className="international-team-note">
        실제 대회 확정 명단이 아닌 게임 내 선발 결과입니다. 선수와 구단을 누르면 상세 정보를 볼 수
        있습니다. 세부 포지션은 게임 내 수비 숙련도 기준입니다.
      </p>
    </section>
  );
}
