'use client';
import { Users } from 'lucide-react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useMatchDelegation } from './use-match-delegation';
export function MatchDelegation({
  g,
  act,
  busy,
  cursor,
  onStart,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  cursor?: number;
  onStart?: () => void;
}) {
  const { coach, delegate } = useMatchDelegation(g, act, busy, cursor, onStart);
  return (
    <div className="match-delegation">
      <div>
        <strong>
          {coach ? `${coach.name} 코치에게 지휘 맡기기` : '경기를 맡길 코치가 없습니다'}
        </strong>
        <small>
          현재 명단으로 {g.liveMatch && (cursor || 0) > 0 ? '남은 경기를' : '경기 전체를'} 진행하고
          결과를 바로 확인합니다. 작전과 투수 교체를 코치가 맡습니다.
        </small>
      </div>
      <button
        className="button secondary"
        disabled={busy || !coach}
        onClick={() => void delegate()}
      >
        <Users size={16} />
        {g.liveMatch && (cursor || 0) > 0 ? '남은 경기 맡기기' : '코치에게 경기 맡기기'}
      </button>
    </div>
  );
}
