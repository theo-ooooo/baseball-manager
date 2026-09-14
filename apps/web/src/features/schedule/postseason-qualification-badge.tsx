import { postseasonLabel, type PostseasonStage } from '@dugout/shared/postseason';
import { Flag, Trophy } from 'lucide-react';

export function PostseasonQualificationBadge({
  confirmed,
  entry,
}: {
  confirmed: boolean;
  entry?: PostseasonStage;
}) {
  const Icon = confirmed ? Trophy : Flag;
  return (
    <span className={`postseason-qualification-badge ${confirmed ? 'confirmed' : 'race'}`}>
      <Icon size={12} aria-hidden="true" />
      {confirmed
        ? entry
          ? entry === 'wildcard'
            ? '와일드카드 진출'
            : `${postseasonLabel(entry, 'kbo')} 직행`
          : 'PS 진출 확정'
        : '현재 PS 진출권'}
    </span>
  );
}
