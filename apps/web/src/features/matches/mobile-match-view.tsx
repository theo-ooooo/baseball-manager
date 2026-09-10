'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { GameState, Result } from '@dugout/shared/types';
import { ClubBadge } from '../../components/club-badge';
import { useWorld } from '../career/world-context';
import { matchReadout } from './match-readout';
export function MatchAtBat({
  result,
  cursor,
  settled = true,
}: {
  result: Result;
  cursor: number;
  settled?: boolean;
}) {
  const view = useMemo(() => matchReadout(result, cursor), [result, cursor]);
  return (
    <div className="match-at-bat" aria-live="polite">
      <span>
        {view.current ? `${view.current.inning}회 ${view.current.half ? '말' : '초'}` : '경기 준비'}
      </span>
      <div>
        <small>{view.current?.play?.plateAppearance === false ? '주자' : '타자'}</small>
        <strong>{view.batter || '선발 명단 확인'}</strong>
        <b>vs</b>
        <small>투수</small>
        <strong>{view.pitcher || '—'}</strong>
      </div>
      <em className={settled ? `outcome-${view.label}` : 'outcome-playing'}>
        {settled ? view.label : '플레이 진행'}
      </em>
    </div>
  );
}
export function MobileMatchView({
  g,
  cursor,
  playing = false,
  speed = 2,
  reduced = false,
  onEnd = () => {},
}: {
  g: GameState;
  cursor: number;
  playing?: boolean;
  speed?: number;
  reduced?: boolean;
  onEnd?: () => void;
}) {
  const result = g.liveMatch!.timeline!,
    changes = g.liveMatch!.changes;
  const view = useMemo(
    () => matchReadout(result, cursor, result.home === g.club ? 1 : 0, changes),
    [result, cursor, g.club, changes],
  );
  const { getClub } = useWorld();
  const columns = useRef<HTMLDivElement>(null);
  const callback = useRef(onEnd);
  useEffect(() => {
    callback.current = onEnd;
  }, [onEnd]);
  useEffect(() => {
    if (!playing || cursor === 0) return;
    const timer = setTimeout(() => callback.current(), (reduced ? 100 : 4200) / speed);
    return () => clearTimeout(timer);
  }, [cursor, playing, speed, reduced]);
  useEffect(() => {
    const pane = columns.current,
      row = pane?.querySelector<HTMLElement>('.current-batter');
    if (!pane || !row) return;
    const top = row.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    if (top < pane.scrollTop) pane.scrollTop = top;
    else if (top + row.offsetHeight > pane.scrollTop + pane.clientHeight)
      pane.scrollTop = top + row.offsetHeight - pane.clientHeight;
  }, [cursor]);
  return (
    <section className="mobile-match-view" aria-label="홈 원정 선수 경기 현황">
      <div className="mobile-match-score">
        {[result.away, result.home].map((id, side) => (
          <div key={id}>
            <span>{side ? 'HOME · 홈' : 'AWAY · 원정'}</span>
            <div>
              <ClubBadge club={getClub(id)} size="small" />
              <strong>{getClub(id).name.split(' ')[0]}</strong>
              <b>{view.score[side]}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="mobile-match-situation">
        <strong>
          {view.current
            ? `${view.current.inning}회 ${view.current.half ? '말' : '초'}`
            : '선발 라인업'}
        </strong>
        <span>{view.current?.play ? `${view.current.play.after.outs} 아웃` : '경기 시작 전'}</span>
        <span>
          주자{' '}
          {view.current?.play?.after.bases
            .map((id, i) => (id ? `${i + 1}루` : null))
            .filter(Boolean)
            .join(' · ') || '없음'}
        </span>
      </div>
      {cursor > 0 && (
        <div className="mobile-current-play" aria-live="polite">
          <small>{view.pitcher || '투수'}의 승부</small>
          <div>
            <strong>{view.batter || '경기 상황'}</strong>
            <em>{view.label}</em>
          </div>
          <p>{view.current?.text}</p>
        </div>
      )}
      <div className="mobile-team-columns" ref={columns}>
        {view.teams?.map((team, side) => (
          <section
            className={view.current?.half === side ? 'is-batting' : ''}
            key={team.club}
            aria-label={`${side ? '홈' : '원정'} 타순`}
          >
            <header>
              <span>{getClub(team.club).name}</span>
              <small>{view.current?.half === side ? '공격 중' : cursor ? '수비' : '선발'}</small>
            </header>
            <ol>
              {team.lineup.map((p, i) => (
                <li
                  key={`${i}:${p.id}`}
                  className={p.active ? 'current-batter' : ''}
                  aria-current={p.active ? 'true' : undefined}
                >
                  <span className="mobile-order">{i + 1}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.position} · #{p.number ?? '—'}
                    </small>
                    <div className="mobile-player-outcomes">
                      {p.outcomes.length ? (
                        p.outcomes.slice(-3).map((label, n) => (
                          <b
                            key={n}
                            className={
                              ['안타', '2루타', '3루타', '홈런'].includes(label)
                                ? 'hit'
                                : ['삼진', '범타', '병살'].includes(label)
                                  ? 'out'
                                  : ''
                            }
                          >
                            {label}
                          </b>
                        ))
                      ) : (
                        <span>타석 대기</span>
                      )}
                    </div>
                  </div>
                  {p.active && <i aria-label="현재 타자" />}
                </li>
              ))}
            </ol>
            <footer>
              <small>마운드</small>
              <strong>{team.pitcher?.name || '기록 없음'}</strong>
            </footer>
          </section>
        ))}
      </div>
    </section>
  );
}
