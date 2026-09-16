import type { LiveMatch } from '@dugout/shared/types';

export function MatchInningHandoff({ live, cursor }: { live: LiveMatch; cursor: number }) {
  const entry = live.inningDelegations?.at(-1);
  if (!entry || cursor !== entry.endCursor) return null;
  const before = live.timeline!.log[entry.cursor - 1]?.score || [0, 0];
  const after = live.timeline!.log[cursor - 1]?.score || [0, 0];
  return (
    <p className="match-inning-handoff" role="status">
      <strong>
        {entry.name} 코치 · {entry.inning}회 지휘 완료
      </strong>
      <span>
        원정 {before[0]} : {before[1]} 홈 → 원정 {after[0]} : {after[1]} 홈
      </span>
      <span>다음 이닝부터 감독님이 지휘합니다.</span>
    </p>
  );
}
