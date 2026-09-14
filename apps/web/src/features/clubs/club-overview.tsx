'use client';
import Link from 'next/link';
import { useStandingsTable } from './use-standings-table';
import { PostseasonQualificationBadge } from '../schedule/postseason-qualification-badge';
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
  const { getClub } = useWorld();
  const view = useStandingsTable(g, league, compact);
  return (
    <>
      {view.qualification && (
        <p className="standings-qualification-note">
          <PostseasonQualificationBadge confirmed={view.qualification === 'confirmed'} />
          <span>
            {view.qualification === 'confirmed'
              ? `정규시즌 최종 순위 · 상위 ${view.slots}개 구단 포스트시즌 진출`
              : `현재 순위 ${view.slots}위까지 진출권 · 정규시즌 종료 후 확정`}
          </span>
        </p>
      )}
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
          {view.rows.map(({ standing: s, rank, own, qualified, gap, entry }) => (
            <TableRow
              key={s.club}
              className={`${own ? 'my-team' : ''} ${qualified ? 'postseason-qualified-row' : ''} ${view.qualification && rank === view.slots ? 'postseason-cutoff-row' : ''}`}
            >
              <TableCell>{rank}</TableCell>
              <TableCell>
                <div className="standings-club-cell">
                  <Link className="table-club" href={`/clubs/${encodeURIComponent(s.club)}`}>
                    <Badge club={getClub(s.club)} size="tiny" />
                    {compact ? getClub(s.club).short : getClub(s.club).name}
                    {own && <span className="you">MY</span>}
                  </Link>
                  {qualified && (
                    <PostseasonQualificationBadge
                      entry={entry}
                      confirmed={view.qualification === 'confirmed'}
                    />
                  )}
                </div>
              </TableCell>
              <TableCell>{s.w}</TableCell>
              <TableCell>{s.l}</TableCell>
              {!compact && <TableCell>{s.d}</TableCell>}
              <TableCell>{s.w + s.l ? (s.w / (s.w + s.l)).toFixed(3) : '.000'}</TableCell>
              {!compact && (
                <>
                  <TableCell>{rank === 1 ? '–' : gap}</TableCell>
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
    </>
  );
}
