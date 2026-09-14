import { Trophy } from 'lucide-react';
import type { Club } from '@dugout/shared/types';
import { ClubBadge } from '../../components/club-badge';
export function PostseasonWaitingCard({
  club,
  title,
  detail,
}: {
  club?: Club;
  title: string;
  detail: string;
}) {
  return (
    <div className="postseason-awaiting">
      {club ? <ClubBadge club={club} size="small" /> : <Trophy size={28} />}
      {club && <strong className="postseason-waiting-club">{club.name}</strong>}
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
