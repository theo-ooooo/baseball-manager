import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';

export function MatchClubStanding({ g, clubId }: { g: GameState; clubId: string }) {
  const { getClub, getLeague, standings } = useWorld();
  const club = getClub(clubId);
  const rows = standings(g, club.league);
  const index = rows.findIndex((row) => row.club === clubId);
  const row = rows[index];
  const ranked = g.phase !== 'preseason' && rows.some((s) => s.w + s.l + s.d > 0);
  return (
    <div className="match-club-standing" aria-label={`${club.name} 리그 순위`}>
      <strong>
        {ranked && row
          ? `${getLeague(club.league).name} ${g.phase === 'regular' ? '' : '정규시즌 '}${index + 1}위`
          : g.phase === 'preseason'
            ? '정규시즌 개막 전'
            : '순위 집계 전'}
      </strong>
      {ranked && row && (
        <span>
          {row.w}승 {row.l}패 {row.d}무
        </span>
      )}
    </div>
  );
}
