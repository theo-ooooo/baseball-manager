'use client';
import { ArrowUpRight } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, overall, money, askPrice } from '@dugout/shared/game-view';
import { potentialText } from '@dugout/shared/ratings';
import { Mood } from '../clubs/club-panels';
import { Rating, PlayerName, positions } from '../../components/game-ui';
import { RoleBadge, assignmentLabel, pitchingAssignment } from '../squad/pitching-panel';

export function PlayerTable({
  players,
  onPlayer,
  kind = 'squad',
  compact = false,
  g,
}: {
  players: Player[];
  onPlayer: (p: Player) => void;
  kind?: string;
  compact?: boolean;
  g: GameState;
}) {
  const { getClub } = useWorld();
  const own = new Set(g.roster.map((p) => p.id));
  return (
    <Table className={`data-table player-table ${compact ? 'player-table-summary' : ''}`}>
      <TableHeader>
        <TableRow>
          <TableHead>선수</TableHead>
          <TableHead className="player-secondary-column">
            {kind === 'market' ? '구분' : '구분 · 보직'}
          </TableHead>
          {!compact && <TableHead>나이</TableHead>}
          <TableHead>OVR</TableHead>
          {g.rules?.revealPotential && <TableHead>잠재력</TableHead>}
          {kind === 'market' ? (
            <>
              <TableHead>소속 구단</TableHead>
              <TableHead>예상 이적료</TableHead>
              <TableHead className="player-secondary-column">연봉</TableHead>
            </>
          ) : (
            <>
              {!compact && <TableHead>사기</TableHead>}
              <TableHead>컨디션</TableHead>
              {!compact && (
                <>
                  <TableHead>경기</TableHead>
                  <TableHead>AVG / ERA</TableHead>
                  <TableHead>HR / 승</TableHead>
                </>
              )}
              <TableHead className="player-secondary-column">연봉</TableHead>
            </>
          )}
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((p) => {
          const role = kind !== 'market' && own.has(p.id) ? pitchingAssignment(g, p) : '';
          return (
            <TableRow key={p.id}>
              <TableCell>
                <PlayerName p={p} onClick={onPlayer} />
                {role && (
                  <small className="ui-role-inline">
                    <RoleBadge role={role}>{assignmentLabel(g, p)}</RoleBadge>
                  </small>
                )}
              </TableCell>
              <TableCell className="player-secondary-column">
                {positions[p.pos]}
                {kind !== 'market' &&
                  (role ? (
                    <small className="block">
                      <RoleBadge role={role}>{assignmentLabel(g, p)}</RoleBadge>
                    </small>
                  ) : (
                    <small className="block muted">{p.squad === 'reserve' ? '2군' : '1군'}</small>
                  ))}
              </TableCell>
              {!compact && (
                <TableCell>
                  {p.age}
                  {p.ageEstimated && <small className="block muted">게임 나이</small>}
                </TableCell>
              )}
              <TableCell>
                <Rating value={overall(p)} player={p} />
              </TableCell>
              {g.rules?.revealPotential && (
                <TableCell>
                  <span className="potential">{potentialText(p)}</span>
                </TableCell>
              )}
              {kind === 'market' ? (
                <>
                  <TableCell>
                    <span className="muted">
                      {p.club === 'fa' ? 'FA · 자유계약' : getClub(p.club)?.name || '이적 선수'}
                    </span>
                  </TableCell>
                  <TableCell>{money(askPrice(p))}</TableCell>
                  <TableCell>{money(p.salary)}</TableCell>
                </>
              ) : (
                <>
                  {!compact && (
                    <TableCell>
                      <Mood p={p} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="condition">
                      <Progress value={p.condition} />
                      <span>{Math.round(p.condition)}%</span>
                    </div>
                  </TableCell>
                  {!compact && (
                    <>
                      <TableCell>{p.stats.g}</TableCell>
                      <TableCell>
                        {p.pos === 'P'
                          ? p.stats.outs
                            ? ((p.stats.er * 27) / p.stats.outs).toFixed(2)
                            : '–'
                          : p.stats.ab
                            ? (p.stats.h / p.stats.ab).toFixed(3)
                            : '–'}
                      </TableCell>
                      <TableCell>{p.pos === 'P' ? p.stats.wins : p.stats.hr}</TableCell>
                    </>
                  )}
                  <TableCell className="player-secondary-column">
                    {money(p.salary)}
                    <small className="block muted">{p.years}년 남음</small>
                  </TableCell>
                </>
              )}
              <TableCell>
                <button
                  className="icon-button"
                  aria-label={`${p.name} 상세 보기`}
                  onClick={() => onPlayer(p)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
