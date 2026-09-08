'use client';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Play,
  Trophy,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, type Result, money } from '@dugout/shared/game-view';
import { dateLabel, daysBetween, gameDate } from '@dugout/shared/calendar';
import { Badge } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';

const tactics: Record<string, string> = {
  balanced: '균형 잡힌 야구',
  power: '장타 중심',
  smallball: '기동력 야구',
  patient: '선구안 중심',
};
const phaseLabel: Record<GameState['phase'], string> = {
  preseason: '프리시즌',
  regular: '정규 시즌',
  semifinal: '포스트시즌 · 준결승',
  final: '포스트시즌 · 결승',
  finished: '시즌 종료',
};
const TIRED = 70;

export function Dashboard({
  g,
  setView,
  simulate,
  act,
  busy,
  onPlayer,
  replay,
}: {
  g: GameState;
  setView: (v: string) => void;
  simulate: () => void;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  replay: (r: Result) => void;
}) {
  const { getClub, getLeague, standings, nextFixture, fixtures } = useWorld();
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
    interviews = g.news.filter((n) => n.choiceKind && !n.choice).length,
    expiring = g.roster.filter((p) => p.years === 1).length;
  const condition = Math.round(
    g.roster.reduce((s, p) => s + p.condition, 0) / Math.max(1, g.roster.length),
  );

  // Look ahead only through the existing calendar and fixture helpers; no new schedule rules.
  const upcoming = (() => {
    if (g.phase === 'regular') {
      const done = new Set(g.history.map((r) => r.fixtureId));
      const f = fixtures(g, league.id).find(
        (f) => (f.home === g.club || f.away === g.club) && f.date > today && !done.has(f.id),
      );
      return f ? { day: g.day + daysBetween(today, f.date), pair: [f.home, f.away] } : null;
    }
    if (g.phase === 'preseason')
      for (let day = g.day + 1; day < 0; day++) {
        const pair = nextFixture({ ...g, day });
        if (pair) return { day, pair };
      }
    return null;
  })();

  const series = g.series.find((s) => s.a === g.club || s.b === g.club),
    seriesTarget = g.phase === 'semifinal' ? 2 : 3,
    ownWins = series ? (series.a === g.club ? series.aw : series.bw) : 0,
    oppWins = series ? (series.a === g.club ? series.bw : series.aw) : 0;

  const standing =
    g.phase === 'preseason'
      ? { value: '개막 준비', sub: `정규시즌 개막까지 ${-g.day}일 · 연습경기 ${friendlies}/4회` }
      : g.phase === 'regular' && played === 0
        ? { value: '개막 대기', sub: `${league.name} ${rows.length}개 구단 · 첫 경기 전` }
        : g.phase === 'semifinal' || g.phase === 'final'
          ? {
              value: series ? `${ownWins}승 ${oppWins}패` : `${rank}위`,
              sub: series
                ? `${phaseLabel[g.phase]} · ${seriesTarget}승 선취 · ${own.w}승 ${own.l}패`
                : `${phaseLabel[g.phase]} 관전 · 정규 ${own.w}승 ${own.l}패`,
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
    { label: '답변을 기다리는 면담', count: interviews, unit: '건', view: 'inbox', urgent: true },
    { label: '안 읽은 소식', count: unread, unit: '건', view: 'inbox' },
    {
      label: `피로한 선수 (컨디션 ${TIRED}% 미만)`,
      count: tired.length,
      unit: '명',
      view: 'squad',
    },
    { label: '계약 잔여 1년', count: expiring, unit: '명', view: 'squad' },
    { label: '진행 중인 협상', count: g.deals.length, unit: '건', view: 'agents' },
  ];
  const recent = g.history.slice(0, 3);

  return (
    <div className="ui-home">
      <section className="ui-stats" aria-label="핵심 지표">
        <button className="ui-stat" onClick={() => setView('world')}>
          <span className="ui-stat-label">
            {g.phase === 'regular' && played ? '리그 순위' : '시즌 상태'}
          </span>
          <strong className="ui-stat-value">{standing.value}</strong>
          <span className="ui-stat-sub">{standing.sub}</span>
        </button>
        <button className="ui-stat" onClick={() => setView('finance')}>
          <span className="ui-stat-label">운영 예산</span>
          <strong className="ui-stat-value">{money(g.budget)}</strong>
          <span className={`ui-stat-sub ${g.budget < 0 ? 'ui-danger' : ''}`}>
            {g.budget < 0 ? '예산 적자 · 재정 확인' : '영입 · 계약 · 운영비'}
          </span>
        </button>
        <button className="ui-stat" onClick={() => setView('squad')}>
          <span className="ui-stat-label">선수단 컨디션</span>
          <strong className="ui-stat-value">
            {condition}
            <small>%</small>
          </strong>
          <span className={`ui-stat-sub ${tired.length ? 'ui-warn' : ''}`}>
            {tired.length ? `${tired.length}명 피로 · ` : ''}
            {g.roster.length}명 · 코치 {g.staff.length}명
          </span>
        </button>
      </section>

      <div className="ui-home-grid">
        <section className="ui-card ui-next" aria-labelledby="ui-next-title">
          <header className="ui-card-head">
            <h2 id="ui-next-title">{fixture ? '다음 경기' : '다음 행동'}</h2>
            <span className="ui-pill">{phaseLabel[g.phase]}</span>
          </header>

          {fixture ? (
            <>
              <p className="ui-next-meta">
                {dateLabel(g)} · {league.name} · {getClub(fixture[0]).city}
                {g.phase === 'preseason' ? ' · 연습경기' : ''}
              </p>
              <div className="ui-matchup">
                <div className={fixture[1] === g.club ? 'own' : ''}>
                  <Badge club={getClub(fixture[1])} size="large" />
                  <strong>{getClub(fixture[1]).name}</strong>
                  <small>원정</small>
                </div>
                <span className="ui-vs">VS</span>
                <div className={fixture[0] === g.club ? 'own' : ''}>
                  <Badge club={getClub(fixture[0])} size="large" />
                  <strong>{getClub(fixture[0]).name}</strong>
                  <small>홈</small>
                </div>
              </div>
              <dl className="ui-next-facts">
                <div>
                  <dt>선발 투수</dt>
                  <dd>
                    {starter ? (
                      <button className="ui-link" onClick={() => onPlayer(starter)}>
                        {starter.name} · {Math.round(starter.condition)}%
                      </button>
                    ) : (
                      '미정'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>전술</dt>
                  <dd>
                    {tactics[g.tactic] || g.tactic} · 선발 {g.lineup.length}명
                  </dd>
                </div>
              </dl>
            </>
          ) : g.phase === 'finished' ? (
            <div className="ui-empty">
              <Trophy size={26} />
              <h3>
                {g.year} 시즌 종료{g.champion ? ` · ${getClub(g.champion).name} 우승` : ''}
              </h3>
              <p>
                {club.name} · 최종 {rank}위. 재계약을 확인한 뒤 다음 시즌을 시작하세요.
              </p>
            </div>
          ) : g.phase === 'semifinal' || g.phase === 'final' ? (
            <div className="ui-empty">
              <Trophy size={26} />
              <h3>{phaseLabel[g.phase]} 진행 중</h3>
              <p>
                {series
                  ? `${getClub(series.a === g.club ? series.b : series.a).name} 상대 ${ownWins}승 ${oppWins}패 · 오늘은 경기가 없습니다.`
                  : '우리 팀은 포스트시즌에 없습니다. 다음 날로 진행하면 시즌이 마무리됩니다.'}
              </p>
            </div>
          ) : (
            <div className="ui-empty">
              <CalendarDays size={26} />
              <h3>
                {playedToday
                  ? '오늘 경기를 마쳤습니다'
                  : g.phase === 'preseason'
                    ? '개막 준비 기간'
                    : '오늘은 휴식일'}
              </h3>
              <p>
                {upcoming
                  ? `다음 ${g.phase === 'preseason' ? '연습경기' : '경기'}: ${dateLabel(g, upcoming.day)} ${
                      getClub(upcoming.pair[0] === g.club ? upcoming.pair[1] : upcoming.pair[0])
                        .name
                    } (${upcoming.pair[0] === g.club ? '홈' : '원정'}) · ${upcoming.day - g.day}일 후`
                  : g.phase === 'preseason'
                    ? `정규시즌 개막까지 ${-g.day}일 · 연습경기 ${friendlies}/4회`
                    : '남은 정규시즌 경기가 없습니다. 다음 날로 진행하면 포스트시즌 여부가 결정됩니다.'}
              </p>
            </div>
          )}

          <div className="ui-card-actions">
            {g.phase === 'finished' ? (
              <button
                className="ui-btn ui-btn-primary"
                disabled={busy}
                onClick={() => void act({ type: 'nextSeason' })}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                다음 시즌 시작
              </button>
            ) : (
              <button
                className="ui-btn ui-btn-primary"
                disabled={busy || !!g.liveMatch}
                onClick={simulate}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                {g.liveMatch ? '경기 진행 중' : fixture ? '경기 진행' : '다음 날로 진행'}
              </button>
            )}
            <button className="ui-btn ui-btn-ghost" onClick={() => setView('tactics')}>
              <ClipboardList size={15} />
              전술 · 타순
            </button>
            <button className="ui-btn ui-btn-ghost" onClick={() => setView('schedule')}>
              <CalendarDays size={15} />
              일정
            </button>
          </div>
        </section>

        <div className="ui-side">
          <section className="ui-card" aria-labelledby="ui-todo-title">
            <header className="ui-card-head">
              <h2 id="ui-todo-title">확인할 일</h2>
              <span className="ui-pill">
                {checklist.filter((c) => c.count).length
                  ? `${checklist.filter((c) => c.count).length}항목`
                  : '없음'}
              </span>
            </header>
            <ul className="ui-todo">
              {checklist.map((c) => (
                <li key={c.label}>
                  <button
                    className={c.count ? (c.urgent ? 'urgent' : '') : 'quiet'}
                    onClick={() => setView(c.view)}
                  >
                    <span>{c.label}</span>
                    <b>{c.count ? `${c.count}${c.unit}` : '없음'}</b>
                    <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="ui-card" aria-labelledby="ui-recent-title">
            <header className="ui-card-head">
              <h2 id="ui-recent-title">최근 결과</h2>
              <button className="ui-link" onClick={() => setView('schedule')}>
                전체 일정 · 결과
                <ChevronRight size={13} />
              </button>
            </header>
            {recent.length ? (
              <ul className="ui-recent">
                {recent.map((r) => {
                  const home = r.home === g.club,
                    us = home ? r.homeScore : r.awayScore,
                    them = home ? r.awayScore : r.homeScore,
                    opp = getClub(home ? r.away : r.home),
                    outcome = us > them ? 'W' : us < them ? 'L' : 'D';
                  return (
                    <li key={r.id}>
                      <button onClick={() => replay(r)}>
                        <span className={`ui-result ${outcome}`}>{outcome}</span>
                        <span className="ui-recent-text">
                          <strong>
                            {us}–{them} {opp.name}
                          </strong>
                          <small>
                            {r.date?.slice(5).replace('-', '/') || dateLabel(g, r.day)} ·{' '}
                            {home ? '홈' : '원정'}
                            {r.friendly ? ' · 연습경기' : r.post ? ' · 포스트시즌' : ''}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ui-quiet">아직 치른 경기가 없습니다.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function StandingsTable({
  g,
  league,
  compact = false,
}: {
  g: GameState;
  league?: string;
  compact?: boolean;
}) {
  const { getClub, standings } = useWorld();
  const rows = standings(g, league);
  const ownIndex = rows.findIndex((s) => s.club === g.club);
  const show = compact
    ? ownIndex >= 8
      ? [...rows.slice(0, 7), rows[ownIndex]]
      : rows.slice(0, 8)
    : rows;
  return (
    <Table className="data-table standings-table">
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>구단</TableHead>
          <TableHead>승</TableHead>
          <TableHead>패</TableHead>
          {!compact && <TableHead>무</TableHead>}
          <TableHead>승률</TableHead>
          {!compact && (
            <>
              <TableHead>승차</TableHead>
              <TableHead>득실</TableHead>
              <TableHead>최근 5경기</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {show.map((s, i) => (
          <TableRow key={s.club} className={s.club === g.club ? 'my-team' : ''}>
            <TableCell>{rows.indexOf(s) + 1}</TableCell>
            <TableCell>
              <span className="table-club">
                <Badge club={getClub(s.club)} size="tiny" />
                {compact ? getClub(s.club).short : getClub(s.club).name}
                {s.club === g.club && <span className="you">MY</span>}
              </span>
            </TableCell>
            <TableCell>{s.w}</TableCell>
            <TableCell>{s.l}</TableCell>
            {!compact && <TableCell>{s.d}</TableCell>}
            <TableCell>{s.w + s.l ? (s.w / (s.w + s.l)).toFixed(3) : '.000'}</TableCell>
            {!compact && (
              <>
                <TableCell>
                  {i === 0 ? '–' : ((rows[0].w - s.w + s.l - rows[0].l) / 2).toFixed(1)}
                </TableCell>
                <TableCell>
                  {s.rf - s.ra > 0 ? '+' : ''}
                  {s.rf - s.ra}
                </TableCell>
                <TableCell>
                  <span className="form">
                    {s.form.map((v, j) => (
                      <span key={j} className={v}>
                        {v}
                      </span>
                    ))}
                  </span>
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
