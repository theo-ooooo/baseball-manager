'use client';
import type { GameState } from '@dugout/shared/types';
import { ClubBadge } from '../../components/club-badge';
import { useWorld } from '../career/world-context';
import { matchReadout } from './match-readout';
import { Stadium2DField } from './stadium-2d-field';
import { Play, ClipboardList, ArrowRight } from 'lucide-react';
import { MatchClubStanding } from './match-club-standing';

export function MatchPreview({
  g,
  busy,
  onPlan,
  onPlay,
}: {
  g: GameState;
  busy: boolean;
  onPlan: () => void;
  onPlay: () => void;
}) {
  const live = g.liveMatch!,
    result = live.timeline!;
  const { getClub } = useWorld();
  const view = matchReadout(result, 0, result.home === g.club ? 1 : 0, live.changes);
  return (
    <div className="match-preview">
      <section className="match-preview-hero">
        <div className="match-preview-field" aria-hidden="true">
          <Stadium2DField viewBox="0 0 1536 1024" />
        </div>
        <div className="match-preview-kicker">
          MATCH DAY{' '}
          <span>
            {result.friendly ? '연습경기' : result.post ? '포스트시즌' : '정규시즌'} · {result.date}
          </span>
        </div>
        <div className="match-preview-fixture">
          {[result.away, result.home].map((id, side) => (
            <div className="match-preview-club" key={id}>
              <small>{side ? 'HOME · 홈' : 'AWAY · 원정'}</small>
              <ClubBadge club={getClub(id)} size="large" />
              <h2>{getClub(id).name}</h2>
              <MatchClubStanding g={g} clubId={id} />
              <span>
                {id === g.club
                  ? `${g.manager} 감독의 팀`
                  : getClub(id).manager
                    ? `${getClub(id).manager!.name} 감독`
                    : getClub(id).city}
              </span>
            </div>
          ))}
          <b className="match-preview-vs">VS</b>
        </div>
        <div className="match-preview-actions">
          <div>
            <strong>오늘의 승부를 준비하세요</strong>
            <p>선발 명단을 비교하고 선수 기용과 경기 계획을 결정합니다.</p>
          </div>
          <button onClick={onPlan} disabled={busy}>
            <ClipboardList size={17} /> 선수·전술 확인
          </button>
          <button className="match-start" onClick={onPlay} disabled={busy}>
            <Play size={17} /> 플레이볼
          </button>
        </div>
      </section>
      <div className="match-preview-lineups">
        {view.teams?.map((team, side) => (
          <section key={team.club} className="match-preview-team">
            <header>
              <ClubBadge club={getClub(team.club)} size="small" />
              <div>
                <small>{side ? '홈' : '원정'} 선발 라인업</small>
                <h3>{getClub(team.club).name}</h3>
              </div>
            </header>
            <div className="match-preview-pitcher">
              <span>선발 투수</span>
              <strong>{team.pitcher?.name || '명단 확인 필요'}</strong>
              <small>#{team.pitcher?.number ?? '—'}</small>
            </div>
            <ol>
              {team.lineup.map((player, index) => (
                <li key={`${index}:${player.id}`}>
                  <span>{index + 1}</span>
                  <strong>{player.name}</strong>
                  <small>#{player.number ?? '—'}</small>
                  <b>{player.position}</b>
                </li>
              ))}
            </ol>
            {team.club === g.club && (
              <button className="match-preview-edit" onClick={onPlan} disabled={busy}>
                선수 교체 · 수비 배치 <ArrowRight size={15} />
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
