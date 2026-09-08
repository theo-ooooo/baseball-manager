'use client';
const tactics = [
  ['balanced', '균형 잡힌 야구', '타격과 출루의 균형'],
  ['power', '장타 중심', '장타 확률 증가 · 삼진 위험'],
  ['smallball', '기동력 야구', '빠른 주자의 적극적인 도루'],
  ['patient', '선구안 중심', '볼넷과 출루 기회 증가'],
];

import { ChevronRight, Target, Trophy } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, type Result, overall, money } from '@dugout/shared/game-view';
import { InboxPanel } from './club-panels';
import { dateLabel } from '@dugout/shared/calendar';
import { DefensiveField } from '../squad/management-panels';
import { Badge, Rating, Metric, PlayerName } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';

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
  const { getClub, getLeague, standings, nextFixture } = useWorld();
  const rows = standings(g),
    own = rows.find((s) => s.club === g.club)!,
    rank = rows.findIndex((s) => s.club === g.club) + 1,
    fixture = nextFixture(g);
  const players = g.lineup.map((id) => g.roster.find((p) => p.id === id)!);
  const pitcher = g.roster.find((p) => p.id === g.starter),
    top = [...g.roster].sort((a, b) => overall(b) - overall(a)).slice(0, 4);
  return (
    <>
      <div className="metrics">
        <Metric
          label="리그 순위"
          value={
            <>
              {rank}
              <small> / {rows.length}</small>
            </>
          }
          sub={`${own.w}승 ${own.l}패 ${own.d}무 · ${(own.w / (own.w + own.l || 1)).toFixed(3)}`}
        />
        <Metric
          label="운영 예산"
          value={money(g.budget)}
          sub={g.budget < 0 ? '예산 적자' : '영입 · 계약 · 운영'}
        />
        <Metric
          label="선수단 컨디션"
          value={
            <>
              {Math.round(g.roster.reduce((s, p) => s + p.condition, 0) / g.roster.length)}
              <small>%</small>
            </>
          }
          sub={`${g.roster.length}명 · ${g.staff.length}명의 코치`}
        />
        <Metric
          label="최근 경기"
          value={
            <div className="form">
              {own.form.length
                ? own.form.map((v, i) => (
                    <span className={v} key={i}>
                      {v}
                    </span>
                  ))
                : Array.from({ length: 5 }, (_, i) => <span key={i}>–</span>)}
            </div>
          }
          sub="최근 5경기"
        />
      </div>
      <div className="dashboard-grid">
        <aside className="briefing-column">
          <InboxPanel g={g} act={act} busy={busy} onPlayer={onPlayer} compact />
          <section className="panel">
            <div className="panel-header">
              <h2>주요 선수</h2>
              <button className="text-button" onClick={() => setView('squad')}>
                선수단
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="top-players">
              {top.map((p) => (
                <div key={p.id}>
                  <PlayerName p={p} onClick={onPlayer} />
                  <Rating value={overall(p)} player={p} />
                </div>
              ))}
            </div>
          </section>
        </aside>
        <div className="main-column">
          <section className="panel next-match">
            <div className="panel-header">
              <h2>다음 경기</h2>
              <span>
                {g.phase === 'preseason'
                  ? '프리시즌'
                  : g.phase === 'regular'
                    ? '정규 시즌'
                    : g.phase === 'finished'
                      ? '시즌 종료'
                      : '포스트시즌'}
              </span>
            </div>
            {fixture ? (
              <>
                <div className="match-meta">
                  <span>{getLeague(getClub(g.club).league).name}</span>
                  <span>
                    {dateLabel(g)} · {getClub(fixture[0]).city}
                  </span>
                </div>
                <div className="matchup">
                  <div>
                    <Badge club={getClub(fixture[1])} size="large" />
                    <strong>{getClub(fixture[1]).name}</strong>
                    <small>원정</small>
                  </div>
                  <div className="versus">
                    <b>v</b>
                  </div>
                  <div>
                    <Badge club={getClub(fixture[0])} size="large" />
                    <strong>{getClub(fixture[0]).name}</strong>
                    <small>홈</small>
                  </div>
                </div>
                <div className="match-bottom">
                  <span>
                    선발 <strong>{pitcher?.name}</strong>
                    <span className="muted">{Math.round(pitcher?.condition || 0)}%</span>
                  </span>
                  <button className="text-button" disabled={busy} onClick={simulate}>
                    경기 진행
                    <ChevronRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Trophy size={25} />
                <h3>
                  {g.phase === 'finished'
                    ? `${getClub(g.champion).name} 우승`
                    : '예정된 경기가 없습니다'}
                </h3>
                <p>
                  {g.phase === 'finished'
                    ? '재계약을 확인한 뒤 다음 시즌을 시작하세요.'
                    : '선수단을 정비하거나 다음 날로 진행하세요.'}
                </p>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>전술 · 수비 배치</h2>
              <button className="text-button" onClick={() => setView('tactics')}>
                설정
                <ChevronRight size={13} />
              </button>
            </div>
            <DefensiveField g={g} onPlayer={onPlayer} compact />
            <div className="tactic-summary">
              <Target size={14} />
              <strong>{tactics.find((t) => t[0] === g.tactic)?.[1]}</strong>
              <span>선발 {players.length}명</span>
            </div>
          </section>
        </div>
        <aside className="right-column">
          <section className="panel">
            <div className="panel-header">
              <h2>리그 순위</h2>
              <button className="text-button" onClick={() => setView('world')}>
                전체
                <ChevronRight size={13} />
              </button>
            </div>
            <StandingsTable g={g} compact />
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>최근 결과</h2>
              <button className="text-button" onClick={() => setView('schedule')}>
                일정
                <ChevronRight size={13} />
              </button>
            </div>
            {g.history.length ? (
              <div className="compact-results">
                {g.history.slice(0, 5).map((r) => (
                  <button key={r.id} onClick={() => replay(r)}>
                    <small>{r.date?.slice(5).replace('-', '/') || dateLabel(g, r.day)}</small>
                    <span>{getClub(r.away).short}</span>
                    <strong>
                      {r.awayScore}–{r.homeScore}
                    </strong>
                    <span>{getClub(r.home).short}</span>
                    <ChevronRight size={12} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>아직 치른 경기가 없습니다.</p>
              </div>
            )}
          </section>
          <section className="panel club-checklist">
            <div className="panel-header">
              <h2>계약 현황</h2>
            </div>
            <button onClick={() => setView('agents')}>
              <span>진행 중인 협상</span>
              <b>{g.deals.length}</b>
              <ChevronRight size={13} />
            </button>
            <button onClick={() => setView('squad')}>
              <span>계약 잔여 1년</span>
              <b>{g.roster.filter((p) => p.years === 1).length}명</b>
              <ChevronRight size={13} />
            </button>
            <button onClick={() => setView('staff')}>
              <span>코칭 스태프</span>
              <b>{g.staff.length}명</b>
              <ChevronRight size={13} />
            </button>
          </section>
        </aside>
      </div>
    </>
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
