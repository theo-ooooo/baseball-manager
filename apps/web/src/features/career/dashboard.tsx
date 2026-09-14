'use client';
import { isPostseasonPhase, postseasonTarget } from '@dugout/shared/postseason';
import { PostseasonPanel } from '../schedule/postseason-panel';
import { MatchWeatherStrip } from '../matches/match-weather-strip';
import { useMatchWeather } from '../matches/use-match-weather';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Play,
  Users,
  ArrowLeftRight,
} from 'lucide-react';
import { useWorld } from './world-context';
import { type GameState, type Player, type Result, money } from '@dugout/shared/game-view';
import { dateLabel, gameDate } from '@dugout/shared/calendar';
import { Badge } from '../../components/game-ui';
import { clubSeasonStatus, isClubSeasonRest } from '@dugout/shared/season-status';
import { needsContractReview } from '@dugout/shared/contract-status';
import { tradeNeedsConfirmation } from '@dugout/shared/trade-status';
import { useUpcomingFixture } from '../matches/use-upcoming-fixture';
const tactics: Record<string, string> = {
  balanced: '균형 잡힌 야구',
  power: '장타 중심',
  smallball: '기동력 야구',
  patient: '선구안 중심',
};
const TIRED = 70;

export function Dashboard({
  g,
  setView,
  simulate,
  continueLabel,
  busy,
  onPlayer,
  replay,
  onReport,
}: {
  g: GameState;
  setView: (v: string) => void;
  simulate: () => void;
  continueLabel: string;
  busy: boolean;
  onPlayer: (p: Player) => void;
  replay: (r: Result) => void;
  onReport: (id: string) => void;
}) {
  const { getClub, getLeague, standings, nextFixture } = useWorld();
  const season = clubSeasonStatus(g);
  const weather = useMatchWeather(g);
  const club = getClub(g.club),
    league = getLeague(club.league),
    rows = standings(g),
    own = rows.find((s) => s.club === g.club)!,
    rank = rows.indexOf(own) + 1,
    played = own.w + own.l + own.d,
    fixture = nextFixture(g),
    today = gameDate(g),
    playedToday = g.history.some((r) => (r.date ? r.date === today : r.day === g.day)),
    friendlies = g.history.filter((r) => r.friendly).length;
  const starter = g.roster.find((p) => p.id === g.starter);
  const tired = g.roster.filter((p) => p.condition < TIRED);
  const unread = g.news.filter((n) => !n.read).length,
    interviews = isClubSeasonRest(g)
      ? 0
      : g.news.filter((n) => n.choiceKind && !n.choice && !n.employmentClosed).length,
    expiring = g.roster.filter((p) => needsContractReview(g, p)).length;
  const readyTrades = g.trades?.filter((offer) => tradeNeedsConfirmation(g, offer)).length || 0;
  const activeDeals = g.deals.filter(
    (d) =>
      ['pending', 'counter', 'accepted'].includes(d.status) &&
      (d.year === undefined || d.year === g.year) &&
      g.day <= (d.expires ?? d.day + 14),
  ).length;
  const scoutReports = g.news.filter(
    (n) => !n.read && n.actionView === 'scouting' && !!n.report?.players?.length,
  );
  const condition = Math.round(
    g.roster.reduce((s, p) => s + p.condition, 0) / Math.max(1, g.roster.length),
  );

  const upcoming = useUpcomingFixture(g);

  const series = g.series.find((s) => s.a === g.club || s.b === g.club),
    seriesTarget = isPostseasonPhase(g.phase) ? postseasonTarget(g.phase, g.postseason?.format) : 0,
    ownWins = series ? (series.a === g.club ? series.aw : series.bw) : 0,
    oppWins = series ? (series.a === g.club ? series.bw : series.aw) : 0;

  const standing =
    g.phase === 'preseason'
      ? { value: '개막 준비', sub: `정규시즌 개막까지 ${-g.day}일 · 연습경기 ${friendlies}/4회` }
      : g.phase === 'regular' && played === 0
        ? { value: '개막 대기', sub: `${league.name} ${rows.length}개 구단 · 첫 경기 전` }
        : isPostseasonPhase(g.phase)
          ? {
              value: series ? `${ownWins}승 ${oppWins}패` : `${rank}위`,
              sub: season.waiting
                ? `${season.label} · 앞선 라운드 승자 대기`
                : !season.eliminated && series
                  ? `${season.label} · ${seriesTarget}승 선취 · ${own.w}승 ${own.l}패`
                  : `우리 팀 시즌 종료 · 정규 ${own.w}승 ${own.l}패 · 타 구단 포스트시즌 진행 중`,
            }
          : {
              value: (
                <>
                  {rank}위<small> / {rows.length}</small>
                </>
              ),
              sub: `${own.w}승 ${own.l}패 ${own.d}무 · 승률 ${(own.w / (own.w + own.l || 1)).toFixed(3)}${
                g.phase === 'finished' ? ' · 시즌 종료' : ''
              }`,
            };

  const checklist = [
    { label: '최종 확정할 트레이드', count: readyTrades, unit: '건', view: 'trade', urgent: true },
    { label: '답변을 기다리는 면담', count: interviews, unit: '건', view: 'inbox', urgent: true },
    { label: '안 읽은 소식', count: unread, unit: '건', view: 'inbox' },
    {
      label: `피로한 선수 (컨디션 ${TIRED}% 미만)`,
      count: tired.length,
      unit: '명',
      view: 'squad',
    },
    { label: '재계약 검토할 선수', count: expiring, unit: '명', view: 'agents' },
    { label: '진행 중인 선수 협상', count: activeDeals, unit: '건', view: 'agents' },
    {
      label: '새 스카우트 메일',
      count: scoutReports.length,
      unit: '건',
      view: 'inbox',
      reportId: scoutReports[0]?.id,
    },
  ];
  const tasks = checklist.filter((item) => item.count > 0);
  const nextPair = fixture || upcoming?.pair;
  const nextDay = fixture ? g.day : (upcoming?.day ?? g.day);
  const leaders = rows.slice(0, 5);
  if (!leaders.some((row) => row.club === g.club)) leaders.push(own);

  return (
    <div className="dashboard dashboard-command-center">
      <header className="dashboard-heading">
        <div>
          <p>
            {club.name} · {season.label}
          </p>
          <h1>감독의 하루</h1>
          <span>{season.detail || `${club.name} · ${g.manager} 감독`}</span>
        </div>
        <div className="dashboard-date">
          <CalendarDays size={17} />
          <span>
            {dateLabel(g)}
            <small>
              {g.year} · {season.label}
            </small>
          </span>
        </div>
      </header>
      <PostseasonPanel g={g} compact />
      <div className="dashboard-command-grid">
        <div className="dashboard-main-column">
          <section className="dashboard-card next-game" aria-labelledby="next-game-title">
            <header>
              <h2 id="next-game-title">
                {fixture ? '오늘의 경기' : nextPair ? '다가오는 경기' : '다음 일정'}
              </h2>
              <span className="dashboard-tag">{season.label}</span>
            </header>
            {weather && (
              <MatchWeatherStrip
                weather={weather.weather}
                showCancellation={g.phase !== 'preseason' && !g.liveMatch}
              />
            )}
            {nextPair ? (
              <>
                <p className="next-game-date">
                  {dateLabel(g, nextDay)} · {getClub(nextPair[0]).city}
                  {!fixture && ` · ${nextDay - g.day}일 후`}
                </p>
                <div className="next-game-clubs">
                  <div>
                    <Badge club={getClub(nextPair[1])} size="large" />
                    <strong>{getClub(nextPair[1]).name}</strong>
                    <small>원정</small>
                  </div>
                  <span>VS</span>
                  <div>
                    <Badge club={getClub(nextPair[0])} size="large" />
                    <strong>{getClub(nextPair[0]).name}</strong>
                    <small>홈</small>
                  </div>
                </div>
                <div className="next-game-plan">
                  <div>
                    <span>예정 선발</span>
                    {starter ? (
                      <button onClick={() => onPlayer(starter)}>
                        {starter.name}
                        <ChevronRight size={13} />
                      </button>
                    ) : (
                      <strong>미정</strong>
                    )}
                  </div>
                  <div>
                    <span>경기 전술</span>
                    <strong>{tactics[g.tactic] || g.tactic}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="dashboard-rest">
                <CalendarDays size={28} />
                <h3>
                  {g.phase === 'finished'
                    ? `${g.year} 시즌을 마쳤습니다`
                    : playedToday
                      ? '오늘 경기를 마쳤습니다'
                      : '다음 경기를 준비하세요'}
                </h3>
                <p>
                  {g.phase === 'finished'
                    ? `${g.champion ? getClub(g.champion).name + ' 우승 · ' : ''}재계약을 확인하고 다음 시즌을 시작하세요.`
                    : series
                      ? `${getClub(series.a === g.club ? series.b : series.a).name} 상대 ${ownWins}승 ${oppWins}패 · ${seriesTarget}승 선취`
                      : '다음 일정으로 진행하면 시즌이 이어집니다.'}
                </p>
              </div>
            )}
            <footer className="next-game-actions">
              <button
                className="button primary"
                disabled={busy || !!g.liveMatch}
                onClick={simulate}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                {continueLabel}
              </button>
              <button className="button secondary" onClick={() => setView('tactics')}>
                <ClipboardList size={15} />
                전술 준비
              </button>
              <button className="dashboard-link" onClick={() => setView('schedule')}>
                전체 일정
                <ChevronRight size={14} />
              </button>
            </footer>
          </section>
          <section className="dashboard-card" aria-labelledby="dashboard-results">
            <header>
              <h2 id="dashboard-results">최근 경기</h2>
              <button className="dashboard-link" onClick={() => setView('schedule')}>
                전체 결과
                <ChevronRight size={14} />
              </button>
            </header>
            {g.history.length ? (
              <ul className="dashboard-results">
                {g.history.slice(0, 4).map((result) => {
                  const home = result.home === g.club,
                    us = home ? result.homeScore : result.awayScore,
                    them = home ? result.awayScore : result.homeScore;
                  const opponent = getClub(home ? result.away : result.home),
                    outcome = us > them ? 'W' : us < them ? 'L' : 'D';
                  return (
                    <li key={result.id}>
                      <button onClick={() => replay(result)}>
                        <span className={`dashboard-result ${outcome}`}>{outcome}</span>
                        <span>
                          <strong>{opponent.name}</strong>
                          <small>
                            {result.date?.slice(5).replace('-', '/') || dateLabel(g, result.day)} ·{' '}
                            {home ? '홈' : '원정'}
                            {result.friendly ? ' · 연습경기' : ''}
                          </small>
                        </span>
                        <b>
                          {us} : {them}
                        </b>
                        <ChevronRight size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="dashboard-empty-results">
                <CalendarDays size={24} />
                <strong>첫 경기를 기다리고 있습니다</strong>
                <p>경기를 마치면 결과와 다시보기가 표시됩니다.</p>
              </div>
            )}
          </section>
          <section
            className="dashboard-card dashboard-shortcuts"
            aria-labelledby="dashboard-players"
          >
            <header>
              <h2 id="dashboard-players">선수단 관리</h2>
              <span>{g.roster.length}명</span>
            </header>
            <button onClick={() => setView('reserves')}>
              <span className="shortcut-icon">
                <ArrowLeftRight size={18} />
              </span>
              <span>
                <strong>1군 · 2군 교체</strong>
                <small>명단을 비교하고 바로 등록</small>
              </span>
              <ChevronRight size={15} />
            </button>
            <button onClick={() => setView('squad')}>
              <span className="shortcut-icon">
                <Users size={18} />
              </span>
              <span>
                <strong>선수 능력 · 기록</strong>
                <small>컨디션과 상세 성적 확인</small>
              </span>
              <ChevronRight size={15} />
            </button>
          </section>
        </div>
        <aside className="dashboard-decision-desk" aria-label="감독 업무와 구단 현황">
          <section className="dashboard-card" aria-labelledby="dashboard-tasks">
            <header>
              <h2 id="dashboard-tasks">확인할 일</h2>
              <span className="dashboard-count">{tasks.length}</span>
            </header>
            {tasks.length ? (
              <ul className="dashboard-task-list">
                {tasks.map((item) => (
                  <li key={item.label}>
                    <button
                      onClick={() => (item.reportId ? onReport(item.reportId) : setView(item.view))}
                    >
                      <span className={item.urgent ? 'task-dot urgent' : 'task-dot'} />
                      <span>{item.label}</span>
                      <b>
                        {item.count}
                        {item.unit}
                      </b>
                      <ChevronRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dashboard-empty">지금은 처리할 일이 없습니다.</p>
            )}
          </section>
          <section className="dashboard-stats" aria-label="구단 현황">
            <button onClick={() => setView('world')}>
              <span>시즌 현황</span>
              <strong>{standing.value}</strong>
              <small>{standing.sub}</small>
            </button>
            <button onClick={() => setView('finance')}>
              <span>운영 예산</span>
              <strong>{money(g.budget)}</strong>
              <small>{g.budget < 0 ? '예산 적자 · 재정 확인' : '계약과 구단 운영에 사용'}</small>
            </button>
            <button onClick={() => setView('squad')}>
              <span>선수단 컨디션</span>
              <strong>
                {condition}
                <small>%</small>
              </strong>
              <small>
                {tired.length
                  ? `휴식이 필요한 선수 ${tired.length}명`
                  : '모든 선수가 경기를 준비하고 있습니다'}
              </small>
            </button>
          </section>
          <section className="dashboard-card" aria-labelledby="dashboard-league">
            <header>
              <h2 id="dashboard-league">
                {league.name} {g.phase === 'preseason' ? '참가 구단' : '순위'}
              </h2>
              <button className="dashboard-link" onClick={() => setView('world')}>
                리그 보기
                <ChevronRight size={14} />
              </button>
            </header>
            <table className="dashboard-standings">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>구단</th>
                  <th>승</th>
                  <th>패</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => (
                  <tr key={row.club} className={row.club === g.club ? 'own' : ''}>
                    <td>{g.phase === 'preseason' ? '–' : rows.indexOf(row) + 1}</td>
                    <td>
                      <Badge club={getClub(row.club)} size="tiny" />
                      {getClub(row.club).name}
                    </td>
                    <td>{row.w}</td>
                    <td>{row.l}</td>
                    <td>{row.w + row.l ? (row.w / (row.w + row.l)).toFixed(3) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </div>
    </div>
  );
}
