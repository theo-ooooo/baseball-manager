'use client';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  defensivePlans,
  type DefensivePlan,
  type TacticalDuel,
} from '@dugout/shared/tactical-duel';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useTacticalDuel } from './use-tactical-duel';

export function TacticalDuelSummary({ duel, ownHome }: { duel: TacticalDuel; ownHome: boolean }) {
  const own = ownHome ? duel.home : duel.away,
    opponent = ownHome ? duel.away : duel.home;
  return (
    <div className="tactical-duel-summary">
      <article>
        <span>우리 벤치 · {own.selected ? '감독 지시' : '코치 판단'}</span>
        <h3>{defensivePlans[own.plan].label}</h3>
        <p>{own.read.detail}</p>
        <strong>{defensivePlans[own.plan].detail}</strong>
        <p>{defensivePlans[own.plan].tradeoff}</p>
      </article>
      <article>
        <span>상대 벤치 · 우리 공격을 분석한 대응</span>
        <h3>{defensivePlans[opponent.plan].label}</h3>
        <p>{opponent.read.detail}</p>
        <strong>{defensivePlans[opponent.plan].detail}</strong>
        <p>{defensivePlans[opponent.plan].tradeoff}</p>
      </article>
    </div>
  );
}
export function TacticalDuelPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const s = useTacticalDuel(g, act, busy);
  if (!s.duel || !s.pair || g.liveMatch) return null;
  return (
    <section className="tactical-duel-panel" aria-label="벤치 수싸움">
      <header>
        <div>
          <span>지난 경기에서 드러난 패턴</span>
          <h2>상대도 우리 야구를 읽고 있습니다</h2>
        </div>
        <button className="button secondary compact" disabled={busy} onClick={s.show}>
          수비 대응 선택
        </button>
      </header>
      <TacticalDuelSummary duel={s.duel} ownHome={s.pair[0] === g.club} />
      <footer>
        <p>
          이 커리어에서 관측한 팀별 최근 4경기를 참고합니다. 양쪽 모두 같은 효과를 받으며 경기 시작
          때 확정됩니다.
        </p>
        <Link href="/?view=tactics">상대 대응을 보고 공격 전술 조정 →</Link>
      </footer>
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="bench-choice-dialog">
          <DialogHeader>
            <DialogTitle>오늘의 수비 대응</DialogTitle>
            <DialogDescription>
              각 대응에는 대가가 있습니다. 선택하지 않으면 코치가 관측 기록을 보고 결정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="bench-choice-list" role="group" aria-label="수비 대응 선택지">
            {(
              Object.entries(defensivePlans) as [
                DefensivePlan,
                (typeof defensivePlans)[DefensivePlan],
              ][]
            ).map(([id, p]) => (
              <button
                key={id}
                aria-pressed={s.plan === id}
                onClick={() => s.setPlan(id)}
                disabled={busy}
              >
                <strong>{p.label}</strong>
                <span>{p.detail}</span>
                <small>{p.tradeoff}</small>
              </button>
            ))}
          </div>
          <button className="button primary" disabled={busy} onClick={() => void s.save()}>
            이 대응으로 준비
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
