'use client';
import { Users, Pause } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import { useWorld } from '../career/world-context';
import type { useSeriesDelegation } from './use-series-delegation';
export function SeriesDelegationPanel({
  g,
  busy,
  control,
}: {
  g: GameState;
  busy: boolean;
  control: ReturnType<typeof useSeriesDelegation>;
}) {
  const { nextFixture, getClub } = useWorld(),
    pair = nextFixture(g),
    run = control.saved;
  const eligible = pair && g.phase !== 'preseason' && g.phase !== 'finished' && !g.liveMatch;
  if (!eligible && !run) return null;
  return (
    <section className="series-delegation-panel" aria-label="연전 위임">
      <div>
        <strong>
          <Users size={16} />{' '}
          {run?.status === 'running'
            ? `${getClub(run.opponent).name} 상대 연전 진행 중`
            : '이번 연전은 코치에게'}
        </strong>
        <p>
          {run
            ? `${run.played}/${run.fixtures.length}경기 완료 · ${run.reason || '한 경기씩 자동 저장합니다.'}`
            : '같은 상대와 최대 3경기. 중요한 결정이 생기면 멈춥니다.'}
        </p>
      </div>
      {control.running ? (
        <button className="button secondary" onClick={control.pause}>
          <Pause size={15} /> 이번 저장 후 멈춤
        </button>
      ) : run?.status === 'running' ? (
        <button className="button secondary" disabled={busy} onClick={() => void control.run(true)}>
          위임 이어가기
        </button>
      ) : eligible ? (
        <button className="button secondary" disabled={busy} onClick={() => control.setOpen(true)}>
          이번 연전 맡기기
        </button>
      ) : null}
      <Dialog open={control.open} onOpenChange={control.setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이번 연전 지휘를 맡깁니다</DialogTitle>
            <DialogDescription>
              오늘부터 같은 상대와 최대 3경기를 코치가 지휘합니다. 현재 명단과 투수 계획을 사용하며,
              카드·증강과 경기 전후 인터뷰도 맡깁니다.
            </DialogDescription>
          </DialogHeader>
          <p>
            필수 면담·계약 답변·중요한 부상 보고가 생기면 멈춥니다. 도중에 멈추거나 화면을 나가도
            완료한 경기는 저장됩니다.
          </p>
          <button className="button primary" disabled={busy} onClick={() => void control.run()}>
            코치에게 연전 지휘 맡기기
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
