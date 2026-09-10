'use client';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ClipboardList } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { useRegistrationBoard } from './use-registration-board';
import { Badge, SearchBox, positions } from '../../components/game-ui';
export function RegistrationBoard({
  g,
  onPlayer,
}: {
  g: GameState;
  onPlayer: (p: Player) => void;
}) {
  const s = useRegistrationBoard(g);
  return (
    <section className="registration-board panel">
      <header className="registration-heading">
        <div>
          <ClipboardList size={19} />
          <h2>등록 · 말소 공시</h2>
        </div>
        <span>
          {s.today} · {s.events.length}건
        </span>
      </header>
      <div className="registration-toolbar">
        <div role="group" aria-label="공시 날짜">
          {[
            ['today', '오늘'],
            ['yesterday', '어제'],
            ['week', '최근 7일'],
          ].map(([id, label]) => (
            <button key={id} aria-pressed={s.period === id} onClick={() => s.setPeriod(id)}>
              {label}
            </button>
          ))}
        </div>
        <select aria-label="공시 구단" value={s.club} onChange={(e) => s.setClub(e.target.value)}>
          <option value="all">리그 전체 구단</option>
          {s.clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <SearchBox value={s.query} onChange={s.setQuery} placeholder="선수 이름 검색" />
      </div>
      <div className="registration-summary">
        <span>
          <ArrowUp size={15} />
          1군 등록 <b>{s.events.filter((e) => e.to === 'first').length}</b>
        </span>
        <span>
          <ArrowDown size={15} />
          1군 말소 <b>{s.events.filter((e) => e.to === 'reserve').length}</b>
        </span>
      </div>
      <div className="registration-entries">
        {s.events.map((e) => {
          const club = s.getClub(e.club),
            player = s.rosterFor(g, e.club).find((p) => p.id === e.playerId);
          return (
            <article key={e.id} className={e.to === 'first' ? 'is-promotion' : 'is-demotion'}>
              <div className="registration-direction">
                {e.to === 'first' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
              </div>
              <div className="registration-person">
                <div>
                  {player ? (
                    <button onClick={() => onPlayer(player)}>{e.name}</button>
                  ) : (
                    <strong>{e.name}</strong>
                  )}
                  <small>{positions[e.pos]}</small>
                </div>
                <Link href={`/clubs/${encodeURIComponent(e.club)}`}>
                  <Badge club={club} size="tiny" />
                  {club.name}
                </Link>
              </div>
              <div className="registration-detail">
                <strong>{e.to === 'first' ? '1군 등록 · 2군 말소' : '1군 말소 · 2군 등록'}</strong>
                <p>{e.reason}</p>
                {e.eligible && <small>{e.eligible}부터 1군 재등록 가능</small>}
              </div>
              <div className="registration-date">
                <time>{e.date.slice(5).replace('-', '/')}</time>
                <small>
                  {e.source === 'club'
                    ? '타 구단 결정'
                    : e.source === 'coach'
                      ? '코치 추천'
                      : '감독 결정'}
                </small>
              </div>
            </article>
          );
        })}
        {!s.events.length && (
          <div className="registration-empty">
            <ClipboardList size={28} />
            <strong>해당 날짜의 등록·말소가 없습니다</strong>
            <p>선수단에서 이동하거나 타 구단이 명단을 조정하면 여기에 공시됩니다.</p>
          </div>
        )}
      </div>
      <footer>
        1군 말소는 계약 해지가 아닙니다. 선수는 2군에서 훈련과 경기를 이어갑니다. 실제 이동부터
        기록하며 최근 30일·최대 600건을 보관합니다.
      </footer>
    </section>
  );
}
