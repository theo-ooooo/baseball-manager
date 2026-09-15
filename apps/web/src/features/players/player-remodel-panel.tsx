'use client';
import type { GameState, Player } from '@dugout/shared/types';
import { remodelPlans, remodelPause, REMODEL_DAYS } from '@dugout/shared/player-remodel';
import { abilityLabels } from '@dugout/shared/development';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { Act } from '../career/game-contracts';
import { usePlayerRemodel } from './use-player-remodel';
export function PlayerRemodelPanel({
  g,
  player: p,
  act,
  busy,
}: {
  g: GameState;
  player: Player;
  act: Act;
  busy: boolean;
}) {
  const s = usePlayerRemodel(g, p, act, busy),
    r = p.remodel,
    plan = r && remodelPlans[r.kind];
  return (
    <section className="player-remodel">
      <header>
        <div>
          <small>코치와 만드는 변화</small>
          <h3>선수의 스타일을 바꿉니다</h3>
          <p>한 가지 강점을 얻는 대신 다른 능력을 조금 내줍니다.</p>
        </div>
        <span className="pill">시즌당 1회 · 동시 3명</span>
      </header>
      {r && plan && (
        <div className="remodel-current">
          <strong>{plan.label}</strong>
          <span>
            {s.active
              ? `${r.days} / ${REMODEL_DAYS}일 훈련`
              : r.status === 'completed'
                ? `${r.finished} 완성`
                : `${r.finished} 중단`}
          </span>
          {s.active ? (
            <>
              <Progress value={(r.days / REMODEL_DAYS) * 100} aria-label="폼 개조 훈련 진척" />
              <p>
                {remodelPause(g, p) ||
                  '훈련하는 날에만 진행합니다. 경기 출전은 계속할 수 있습니다.'}
              </p>
              <button
                className="button secondary compact"
                disabled={s.locked}
                onClick={() => void s.cancel()}
              >
                개조 중단 · 이번 시즌 재시작 불가
              </button>
            </>
          ) : (
            r.status === 'completed' && (
              <p>
                {abilityLabels[plan.gain]} +{(r.gained || 0).toFixed(2)} ·{' '}
                {abilityLabels[plan.cost]} −{(r.lost || 0).toFixed(2)}
                <br />
                현재 능력에 반영됐습니다.
              </p>
            )
          )}
        </div>
      )}
      {!s.active && (
        <button
          className="button primary"
          disabled={s.locked || s.used}
          onClick={() => s.setOpen(true)}
        >
          {s.used ? '다음 시즌에 다시 개조 가능' : '개조 방향 선택'}
        </button>
      )}
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="remodel-dialog">
          <DialogHeader>
            <DialogTitle>{p.name} · 폼 개조</DialogTitle>
            <DialogDescription>
              훈련 {REMODEL_DAYS}일 후 능력이 바뀝니다. 중단해도 이번 시즌의 기회는 사용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="remodel-options">
            {s.plans.map((k) => {
              const x = remodelPlans[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={s.kind === k}
                  disabled={s.locked}
                  onClick={() => s.setKind(k)}
                >
                  <strong>{x.label}</strong>
                  <p>{x.detail}</p>
                  <span>
                    <b>
                      {abilityLabels[x.gain]} 최대 +{x.amount}
                    </b>{' '}
                    / {abilityLabels[x.cost]} −{x.loss}
                  </span>
                </button>
              );
            })}
          </div>
          <p>
            부상·대표팀 차출·휴식일에는 쉬어 갑니다. 성장 여력이 적으면 상승량과 감소량이 함께
            줄어듭니다. 개조를 마치기 전에는 능력을 바꾸지 않습니다.
          </p>
          <button
            className="button primary"
            disabled={s.locked || !s.kind}
            onClick={() => void s.submit()}
          >
            이 방향으로 훈련 시작
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
