'use client';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import { useInternationalTeams } from './use-international-teams';

export function InternationalTeamsPanel({ g }: { g: GameState }) {
  const teams = useInternationalTeams(g);
  const { event, selection, country, players } = teams;
  return (
    <section
      id="national-teams"
      className="panel international-teams"
      aria-label="나라별 국가대표 팀"
    >
      <div className="panel-header">
        <h2>나라별 국가대표 팀</h2>
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
        <ul className="international-team-roster">
          {players.map((p) => (
            <li key={p.id}>
              <span className="international-position">{p.pos}</span>
              <div>
                <Link href={`/players/${encodeURIComponent(p.id)}`}>{p.name}</Link>
                <small>
                  {p.age}세 · {p.real ? '실제 선수' : '생성 선수'}
                </small>
              </div>
              {p.club === 'fa' ? (
                <span className="international-player-club">자유계약</span>
              ) : (
                <Link
                  className="international-player-club"
                  href={`/clubs/${encodeURIComponent(p.club)}`}
                >
                  {teams.getClub(p.club)?.name || p.club}
                </Link>
              )}
            </li>
          ))}
        </ul>
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
        있습니다.
      </p>
    </section>
  );
}
