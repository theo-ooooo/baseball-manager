'use client';
import type { GameState } from '@dugout/shared/types';
import type { TradeSuggestion } from '@dugout/shared/trade-recommendations';
import { money } from '@dugout/shared/game-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useWorld } from '../career/world-context';
import { useTradeRecommendationPicker } from './use-trade-recommendations';
export function TradeRecommendationsPicker({
  g,
  club,
  incoming,
  offerId,
  onSelect,
  disabled,
  label = '트레이드 선수 추천',
}: {
  g: GameState;
  club?: string;
  incoming?: string[];
  offerId?: string;
  onSelect: (s: TradeSuggestion) => void;
  disabled: boolean;
  label?: string;
}) {
  const s = useTradeRecommendationPicker(g, { club, incoming, offerId }, onSelect),
    { getClub } = useWorld();
  return (
    <>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => s.setOpen(true)}
      >
        {label}
      </button>
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="trade-recommendations-dialog">
          <DialogHeader>
            <DialogTitle>이 선수를 받고, 이 선수를 내주는 안</DialogTitle>
            <DialogDescription>
              핵심 선수는 추천 대가에서 제외합니다. 추천안을 골라 조건을 검토한 뒤 제안하세요.
            </DialogDescription>
          </DialogHeader>
          {s.loading ? (
            <p role="status">두 구단의 선수 구성과 예산을 맞춰보고 있습니다…</p>
          ) : s.error ? (
            <div role="alert">
              <p>{s.error}</p>
              <button className="button secondary" onClick={s.retry}>
                다시 확인
              </button>
            </div>
          ) : (
            <>
              <p>{s.result?.message}</p>
              <div className="trade-suggestion-list">
                {s.result?.suggestions.map((r, i) => (
                  <article key={`${r.club}:${i}`}>
                    <small>
                      {getClub(r.club).name}
                      {r.deadlineId ? ' · 마감 영입 경쟁' : ''}
                    </small>
                    <div className="trade-suggestion-exchange">
                      <div>
                        <span>우리가 받을 선수</span>
                        <strong>{r.incoming.map((p) => p.name).join(' · ')}</strong>
                        <small>{r.incoming.map((p) => `${p.pos} · ${p.age}세`).join(' / ')}</small>
                      </div>
                      <b aria-hidden="true">⇄</b>
                      <div>
                        <span>우리가 보낼 선수</span>
                        <strong>{r.outgoing.map((p) => p.name).join(' · ')}</strong>
                        <small>{r.outgoing.map((p) => `${p.pos} · ${p.age}세`).join(' / ')}</small>
                      </div>
                    </div>
                    <p>
                      <b>
                        추가 {r.cash >= 0 ? '지급' : '수령'} {money(Math.abs(r.cash))}
                      </b>
                    </p>
                    <p>{r.reason}</p>
                    <p className="trade-suggestion-cost">{r.cost}</p>
                    <button
                      className="button primary"
                      disabled={disabled}
                      onClick={() => s.choose(r)}
                    >
                      이 안으로 조건 검토
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
