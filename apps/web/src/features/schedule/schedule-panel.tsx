'use client';
import { InternationalCalendarPanel } from './international-calendar-panel';
import { InternationalTeamsPanel } from './international-teams-panel';
import { PostseasonPanel } from './postseason-panel';
import { ClubBadge } from '../../components/club-badge';
import type { GameState, Result } from '@dugout/shared/types';
import { dateLabel } from '@dugout/shared/calendar';
import { cancellationLabel, matchWeather } from '@dugout/shared/match-weather';
import { postseasonLabel } from '@dugout/shared/postseason';
import { MatchWeatherStrip } from '../matches/match-weather-strip';
import { useWorld } from '../career/world-context';
import { useSchedule } from './use-schedule';
export function SchedulePanel({ g, replay }: { g: GameState; replay: (r: Result) => void }) {
  const { getClub } = useWorld(),
    view = useSchedule(g);
  return (
    <>
      <PostseasonPanel g={g} />
      <InternationalCalendarPanel g={g} />
      <InternationalTeamsPanel g={g} />
      <section className="panel">
        <div className="panel-header">
          <h2>경기 일정</h2>
          <span>{view.scheduleNote}</span>
        </div>
        <div className="toolbar">
          <div className="toolbar-controls">
            <button
              className="button secondary compact"
              aria-label="이전 달"
              onClick={() => view.changeMonth(-1)}
            >
              ←
            </button>
            <strong>{view.month.replace('-', '년 ')}월</strong>
            <button
              className="button secondary compact"
              aria-label="다음 달"
              onClick={() => view.changeMonth(1)}
            >
              →
            </button>
            <button className="text-button" onClick={() => view.setMonth(view.today.slice(0, 7))}>
              현재 날짜
            </button>
          </div>
          <select
            aria-label="일정 범위"
            value={view.scope}
            onChange={(e) => view.setScope(e.target.value)}
          >
            <option value="league">리그 전체 경기</option>
            <option value="club">내 구단 경기</option>
          </select>
        </div>
        <div className="season-calendar">
          {view.days.map(({ date, day, fixtures, cancellations, friendly }) => (
            <div key={date} className={`calendar-day ${date === view.today ? 'today' : ''}`}>
              <div className="calendar-date">
                <strong>{dateLabel(g, day)}</strong>
                {date === view.today && <span className="pill lime">오늘</span>}
              </div>
              <div className="calendar-games">
                {cancellations.map((cancel) => (
                  <div
                    key={`${cancel.fixture.id}-${cancel.date}`}
                    className="calendar-cancellation"
                  >
                    <strong>{cancellationLabel(cancel.reason)}</strong>
                    <span>
                      {getClub(cancel.fixture.away).short} · {getClub(cancel.fixture.home).short}
                    </span>
                    <small>{cancel.fixture.date.slice(5).replace('-', '/')} 재편성</small>
                  </div>
                ))}
                {fixtures.map((f) => {
                  const result = view.scores.get(f.id),
                    own = f.home === g.club || f.away === g.club,
                    post = 'post' in f ? f : undefined;
                  const score = result
                    ? { home: result.homeScore, away: result.awayScore }
                    : post?.score;
                  const cancelled = post?.status === 'cancelled';
                  return (
                    <div
                      key={f.id}
                      className={`calendar-game ${own ? 'own' : ''} ${post ? 'postseason-game' : ''} ${cancelled ? 'not-played' : ''}`}
                    >
                      {post && (
                        <b className="calendar-postseason-label">
                          {postseasonLabel(post.stage)} · {post.game}차전
                        </b>
                      )}
                      <span className="club-label">
                        <ClubBadge club={getClub(f.away)} size="tiny" />
                        {getClub(f.away).name}
                      </span>
                      <strong>
                        {score ? `${score.away} : ${score.home}` : cancelled ? '—' : 'vs'}
                      </strong>
                      <span className="club-label">
                        <ClubBadge club={getClub(f.home)} size="tiny" />
                        {getClub(f.home).name}
                      </span>
                      <small>
                        {score
                          ? '종료'
                          : cancelled
                            ? '미개최 · 시리즈 종료'
                            : post?.status === 'conditional'
                              ? '필요 시 개최'
                              : date < view.today
                                ? '기록 없음'
                                : f.time || '예정'}{' '}
                        · {getClub(f.home).city}
                      </small>
                      {!cancelled && (result?.weather || date >= view.today) && (
                        <MatchWeatherStrip
                          compact
                          weather={result?.weather || matchWeather(g, f, getClub(f.home))}
                        />
                      )}
                      {g.weather?.postponed[f.id] && (
                        <small className="calendar-rescheduled">기상 취소 후 재편성</small>
                      )}
                      {own && result && (
                        <button className="text-button" onClick={() => replay(result)}>
                          리플레이 →
                        </button>
                      )}
                    </div>
                  );
                })}
                {friendly && (
                  <div className="calendar-game own">
                    <span>{getClub(friendly.pair[1]).name}</span>
                    <strong>연습</strong>
                    <span>{getClub(friendly.pair[0]).name}</span>
                    {date >= view.today && (
                      <MatchWeatherStrip
                        compact
                        weather={matchWeather(
                          g,
                          { home: friendly.pair[0], date },
                          getClub(friendly.pair[0]),
                        )}
                      />
                    )}
                  </div>
                )}
                {!fixtures.length && !friendly && !cancellations.length && (
                  <span className="muted">
                    {day < 0 ? '프리시즌 · 훈련' : '휴식일 · 선수단 정비'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="panel-foot">
          이달 {view.count}경기 · 왼쪽 원정 / 오른쪽 홈
          <span>
            ‘필요 시’ 경기는 시리즈 승부가 이어질 때 개최합니다. 날씨는 게임에서 생성됩니다.
          </span>
        </div>
      </section>
      <section className="panel training-block">
        <div className="panel-header">
          <h2>우리 구단 경기 기록</h2>
          <span>{g.history.length}경기</span>
        </div>
        {g.history.map((r) => (
          <button className="result-row" key={r.id} onClick={() => replay(r)}>
            <span className="muted">
              {r.date?.slice(5).replace('-', '/') || dateLabel(g, r.day)}
              {r.post && ' · PS'}
            </span>
            <span className="club-label">
              <ClubBadge club={getClub(r.away)} size="tiny" />
              {getClub(r.away).short}
            </span>
            <strong>
              {r.awayScore} : {r.homeScore}
            </strong>
            <span className="club-label">
              <ClubBadge club={getClub(r.home)} size="tiny" />
              {getClub(r.home).short}
            </span>
            <span>리플레이 →</span>
          </button>
        ))}
      </section>
    </>
  );
}
