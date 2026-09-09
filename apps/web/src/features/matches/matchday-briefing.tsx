'use client';
import { ArrowRight, ClipboardList, Users } from 'lucide-react';
import type { GameState, Player } from '@dugout/shared/types';
import { dateLabel } from '@dugout/shared/calendar';
import { ratingText } from '@dugout/shared/ratings';
import { Badge } from '../../components/game-ui';
import { useWorld } from '../career/world-context';

export function MatchdayBriefing({
  g,
  onView,
  onPlayer,
  onContinue,
  label,
  busy,
}: {
  g: GameState;
  onView: (view: string) => void;
  onPlayer: (p: Player) => void;
  onContinue: () => void;
  label: string;
  busy: boolean;
}) {
  const { nextFixture, getClub, standings } = useWorld();
  const pair = nextFixture(g);
  if (!pair)
    return (
      <section className="panel panel-content matchday-rest">
        <h2>오늘은 훈련과 구단 업무를 보는 날입니다</h2>
        <p>수신함을 확인하고 진행하면 다음 보고나 경기일에 멈춥니다.</p>
        <button className="button primary" disabled={busy} onClick={onContinue}>
          {label} <ArrowRight size={16} />
        </button>
      </section>
    );
  const [home, away] = pair.map(getClub);
  const opponent = getClub(pair.find((id) => id !== g.club)!);
  const standing = standings(g).find((s) => s.club === opponent.id);
  const byId = new Map(g.roster.map((p) => [p.id, p]));
  const lineup = g.lineup.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const starter = byId.get(g.starter);
  const tired = [...lineup, ...(starter ? [starter] : [])].filter((p) => p.condition < 70);
  const issues = [
    ...(!starter ? ['선발 투수를 지정해 주세요.'] : []),
    ...(lineup.length !== 9 ? ['선발 타순 9명을 확인해 주세요.'] : []),
    ...(tired.length ? [`피로 점검: ${tired.map((p) => p.name).join(', ')}`] : []),
  ];
  return (
    <div className="matchday-briefing">
      <section className="matchday-overview">
        <div className="matchday-caption">
          <span>MATCHDAY · 경기 전 브리핑</span>
          <time>{dateLabel(g)}</time>
        </div>
        <div className="matchday-clubs">
          <div>
            <Badge club={away} size="large" />
            <h2>{away.name}</h2>
            <small>원정</small>
          </div>
          <strong>VS</strong>
          <div>
            <Badge club={home} size="large" />
            <h2>{home.name}</h2>
            <small>홈</small>
          </div>
        </div>
        <p className="matchday-coach-note">
          <strong>수석 코치 브리핑</strong>
          {issues.length
            ? issues.join(' · ')
            : '출전 준비가 됐습니다. 선발과 타순을 최종 확인하고 경기장으로 이동하세요.'}
        </p>
        <div className="matchday-actions">
          <button className="button secondary" onClick={() => onView('tactics')}>
            <ClipboardList size={16} /> 타순·전술 점검
          </button>
          <button className="button secondary" onClick={() => onView('reserves')}>
            <Users size={16} /> 1군·2군 교체
          </button>
          <button className="button primary" disabled={busy} onClick={onContinue}>
            {label}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <div className="matchday-grid">
        <section className="matchday-lineup">
          <header>
            <h3>제출할 선수단</h3>
            <small>경기장에서도 플레이볼 전 변경 가능</small>
          </header>
          {starter && (
            <button className="matchday-starter" onClick={() => onPlayer(starter)}>
              <span>선발투수</span>
              <strong>{starter.name}</strong>
              <small>컨디션 {Math.round(starter.condition)}%</small>
            </button>
          )}
          <ol>
            {lineup.map((p, i) => (
              <li key={p.id}>
                <b>{i + 1}</b>
                <button onClick={() => onPlayer(p)}>
                  {p.name}
                  <small>{p.pos}</small>
                </button>
                <span>OVR {ratingText(p)}</span>
                <span className={p.condition < 70 ? 'tired' : ''}>{Math.round(p.condition)}%</span>
              </li>
            ))}
          </ol>
        </section>
        <aside className="matchday-opponent">
          <h3>상대와 오늘의 준비</h3>
          <strong>{opponent.name}</strong>
          <p>
            {g.phase === 'preseason'
              ? '프리시즌 · 연습경기'
              : standing
                ? `${standing.w}승 ${standing.l}패 ${standing.d}무`
                : '포스트시즌 경기'}
          </p>
          {standing?.form.length ? (
            <div className="matchday-form" aria-label="상대 최근 경기 결과">
              {standing.form.map((r, i) => (
                <span className={r} key={i}>
                  {r === 'W' ? '승' : r === 'L' ? '패' : '무'}
                </span>
              ))}
            </div>
          ) : null}
          <hr />
          <h4>오늘의 경기 흐름</h4>
          <ol className="matchday-steps">
            <li aria-current="step">선수단·전술 점검</li>
            <li>경기장 · 최종 선수 선택</li>
            <li>플레이볼 · 경기 지휘</li>
            <li>경기 후 보고 · 다음 일정</li>
          </ol>
          <p>팀 구성을 바꾸고 이 화면으로 돌아오면 최신 명단이 반영됩니다.</p>
        </aside>
      </div>
    </div>
  );
}
