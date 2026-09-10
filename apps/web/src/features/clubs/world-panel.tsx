'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, overall } from '@dugout/shared/game-view';
import { Choice, Empty } from '../../components/game-ui';
import { StandingsTable } from './club-overview';
import { PlayerTable } from '../players/player-table';

export function World({ g, onPlayer }: { g: GameState; onPlayer: (p: Player) => void }) {
  const { clubs, leagues, getClub, getLeague, rosterFor } = useWorld();
  const [lid, setLid] = useState(getClub(g.club).league),
    [team, setTeam] = useState('');
  const l = getLeague(lid);
  const roster = team && team !== 'none' ? rosterFor(g, team) : [];
  return (
    <>
      <div className="world-strip">
        {leagues.map((v) => (
          <button
            key={v.id}
            className={lid === v.id ? 'selected' : ''}
            onClick={() => {
              setLid(v.id);
              setTeam('');
            }}
          >
            <span>{v.flag}</span>
            <strong>{v.name}</strong>
            <small>{v.country}</small>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>
            {l.flag} {l.label}
          </h2>
          <a href={l.source} target="_blank" rel="noreferrer" className="text-button">
            공식 리그 <ExternalLink size={14} />
          </a>
        </div>
        <StandingsTable g={g} league={lid} />
        <div className="panel-foot">
          {l.country} · {l.season}
          <span>게임 내 순위 · 현실 리그 성적과 별도</span>
        </div>
      </section>
      <section className="panel club-inspector">
        <div className="panel-header">
          <h2>세계 구단 선수단</h2>
          <Choice
            label="구단 선수단 보기"
            value={team || 'none'}
            onChange={setTeam}
            items={[
              { value: 'none', label: '구단을 선택하세요' },
              ...clubs.filter((c) => c.league === lid).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        {team && team !== 'none' ? (
          <PlayerTable
            players={[...roster].sort((a, b) => overall(b) - overall(a))}
            onPlayer={onPlayer}
            kind="market"
            g={g}
          />
        ) : (
          <Empty text="구단을 선택하면 실명 선수와 유망주를 살펴볼 수 있습니다." />
        )}
      </section>
      <section className="panel panel-content">
        <h2>세계 구단 소식</h2>
        <p className="muted">
          다른 구단도 영입과 감독 선임을 진행합니다. 타 구단의 일반 경기는 점수에 맞춘 간이 선수
          기록을 집계합니다.
        </p>
        {(g.simulation?.events || [])
          .filter(
            (e) => getClub(e.club)?.league === lid || getClub(e.otherClub || '')?.league === lid,
          )
          .slice(0, 25)
          .map((e) => (
            <p key={e.id}>
              <small>{e.date}</small> · {e.text}
            </p>
          ))}
        {!g.simulation?.events.length && <p>날짜가 진행되면 구단들의 활동이 이곳에 쌓입니다.</p>}
      </section>
    </>
  );
}
