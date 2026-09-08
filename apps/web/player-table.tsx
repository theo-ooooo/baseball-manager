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
import { useWorld } from './world-context';
import {
  type GameState,
  type Player,
  overall,
  money,
  askPrice,
} from '../../packages/shared/src/game-view';
import { potentialText } from '../../packages/shared/src/ratings';
import { Mood } from './club-panels';
import { Rating, PlayerName, positions } from './game-ui';

export function PlayerTable({
  players,
  onPlayer,
  kind = 'squad',
  g,
}: {
  players: Player[];
  onPlayer: (p: Player) => void;
  kind?: string;
  g: GameState;
}) {
  const { getClub } = useWorld();
  return (
    <Table className="data-table player-table">
      <TableHeader>
        <TableRow>
          <TableHead>선수</TableHead>
          <TableHead>구분</TableHead>
          <TableHead>나이</TableHead>
          <TableHead>OVR</TableHead>
          {g.rules?.revealPotential && <TableHead>잠재력</TableHead>}
          {kind === 'market' ? (
            <>
              <TableHead>소속 구단</TableHead>
              <TableHead>예상 이적료</TableHead>
              <TableHead>연봉</TableHead>
            </>
          ) : (
            <>
              <TableHead>사기</TableHead>
              <TableHead>컨디션</TableHead>
              <TableHead>경기</TableHead>
              <TableHead>AVG / ERA</TableHead>
              <TableHead>HR / 승</TableHead>
              <TableHead>연봉</TableHead>
            </>
          )}
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <PlayerName p={p} onClick={onPlayer} />
            </TableCell>
            <TableCell>
              {positions[p.pos]}
              {kind !== 'market' && (
                <small className="block muted">{p.squad === 'reserve' ? '2군' : '1군'}</small>
              )}
            </TableCell>
            <TableCell>
              {p.age}
              {p.ageEstimated && <small className="block muted">게임 나이</small>}
            </TableCell>
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
                <TableCell>
                  <Mood p={p} />
                </TableCell>
                <TableCell>
                  <div className="condition">
                    <Progress value={p.condition} />
                    <span>{Math.round(p.condition)}%</span>
                  </div>
                </TableCell>
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
                <TableCell>
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
        ))}
      </TableBody>
    </Table>
  );
}
