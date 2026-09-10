'use client';
import Link from 'next/link';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useWorld } from '../career/world-context';
import type { GameState } from '@dugout/shared/types';
import { Badge } from '../../components/game-ui';

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
              <Link className="table-club" href={`/clubs/${encodeURIComponent(s.club)}`}>
                <Badge club={getClub(s.club)} size="tiny" />
                {compact ? getClub(s.club).short : getClub(s.club).name}
                {s.club === g.club && <span className="you">MY</span>}
              </Link>
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
