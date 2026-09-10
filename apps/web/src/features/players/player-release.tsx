'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import type { Act } from '../career/game-contracts';
import { usePlayerRelease } from './use-player-release';

export function PlayerRelease({
  g,
  player,
  act,
  busy,
}: {
  g: GameState;
  player: Player;
  act: Act;
  busy: boolean;
}) {
  const r = usePlayerRelease(g, player, act, busy);
  return (
    <>
      <button
        className="button secondary player-release-button"
        disabled={busy}
        onClick={() => r.setOpen(true)}
      >
        선수 방출
      </button>
      <Dialog
        open={r.open}
        onOpenChange={(open) => {
          if (!busy) r.setOpen(open);
        }}
      >
        <DialogContent className="player-release-dialog">
          <DialogHeader>
            <DialogTitle>{player.name} 방출</DialogTitle>
            <DialogDescription>계약을 종료하고 자유계약 선수로 내보냅니다.</DialogDescription>
          </DialogHeader>
          <dl className="release-summary">
            <div>
              <dt>현재 연봉 · 남은 기간</dt>
              <dd>
                {money(player.salary)} · {player.years}년
              </dd>
            </div>
            <div>
              <dt>잔여 보장 연봉 정산</dt>
              <dd>{money(r.cost)}</dd>
            </div>
            <div>
              <dt>정산 후 구단 예산</dt>
              <dd>{money(g.budget - r.cost)}</dd>
            </div>
          </dl>
          <p>
            게임 내 계약 기준으로 미지급 연봉을 일괄 정산합니다. 타순·보직과 진행 중인 재계약
            협상에서 제외되며, 이후 급여는 지급하지 않습니다.
          </p>
          {r.error && (
            <p role="alert" className="rule-notice">
              {r.error}
            </p>
          )}
          <div className="release-actions">
            <button className="button secondary" disabled={busy} onClick={() => r.setOpen(false)}>
              취소
            </button>
            <button
              className="button primary"
              disabled={busy || !!r.error}
              onClick={() => void r.confirm()}
            >
              {busy ? '방출 처리 중…' : `${money(r.cost)} 정산 · 방출 확정`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
