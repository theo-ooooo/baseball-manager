'use client';
import { usePlayerOffer } from './use-player-offer';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Deal } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import type { PlayerContractProps as Props } from './contract-types';

export function PlayerOfferForm({
  player,
  g,
  act,
  busy,
  deal,
  own,
  blocked,
  onSent,
}: Props & { deal?: Deal; own: boolean; blocked: boolean; onSent: () => void }) {
  const {
    salary,
    setSalary,
    years,
    setYears,
    fee,
    setFee,
    amount,
    agentFee,
    retained,
    transfer,
    cost,
    valid,
  } = usePlayerOffer(player, g, deal, own);
  return (
    <form
      className="contract-offer-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        const next = await act({
          type: 'negotiate',
          id: player.id,
          salary: amount,
          years,
          renew: own,
          fee: transfer,
        });
        if (next) {
          onSent();
          toast.success('조건을 제안했습니다. 날짜를 진행하면 답변이 도착합니다.');
        }
      }}
    >
      <div className="contract-proposal-heading">
        <h3>우리 구단의 제안</h3>
        <small>금액 단위: 만 원</small>
      </div>
      <div className="contract-term-row">
        <label htmlFor={`salary-${player.id}`}>
          보장 연봉<small>현재 {money(player.salary)}</small>
        </label>
        <div>
          <div className="contract-number">
            <button
              type="button"
              aria-label="제안 연봉 5% 낮추기"
              onClick={() => setSalary(String(Math.max(1, Math.round(Number(salary) * 0.95))))}
            >
              −
            </button>
            <input
              id={`salary-${player.id}`}
              aria-label="제안 연봉 (만 원)"
              type="number"
              min="1"
              max="140000000"
              step="1"
              required
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <button
              type="button"
              aria-label="제안 연봉 5% 높이기"
              onClick={() => setSalary(String(Math.max(1, Math.round(Number(salary) * 1.05))))}
            >
              +
            </button>
          </div>
          <small>{money(Number.isFinite(amount) ? amount : 0)} / 시즌</small>
        </div>
      </div>
      <div className="contract-term-row">
        <span>
          계약 기간<small>1~5년 계약</small>
        </span>
        <div className="contract-year-options" role="group" aria-label="제안 계약 기간">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} aria-pressed={years === n} onClick={() => setYears(n)}>
              {n}년
            </button>
          ))}
        </div>
      </div>
      {!own && player.club !== 'fa' && (
        <div className="contract-term-row">
          <label htmlFor={`fee-${player.id}`}>
            이적료<small>{retained ? '소속 구단과 합의 완료' : '소속 구단에 별도 제안'}</small>
          </label>
          {retained ? (
            <strong>{money(transfer)}</strong>
          ) : (
            <div>
              <input
                id={`fee-${player.id}`}
                aria-label="제안 이적료 (만 원)"
                type="number"
                min="0"
                required
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <small>{money(Number.isFinite(transfer) ? transfer : 0)}</small>
            </div>
          )}
        </div>
      )}
      <details className="contract-estimate">
        <summary>부대 비용 · 서명 시 예상 지출 {money(valid ? cost : 0)}</summary>
        <div>
          <span>계약금 · 연봉의 5%</span>
          <strong>{money(valid ? amount * 0.05 : 0)}</strong>
        </div>
        <div>
          <span>에이전트 수수료</span>
          <strong>{money(valid ? agentFee : 0)}</strong>
        </div>
        <div>
          <span>서명 시 예상 지출</span>
          <strong>{money(valid ? cost : 0)}</strong>
        </div>
      </details>
      {valid && cost > g.budget && (
        <p className="rule-notice">
          가용 예산을 {money(cost - g.budget)} 초과합니다. 조건을 낮춰 주세요.
        </p>
      )}
      <div className="contract-room-actions">
        <button
          className="button primary"
          disabled={busy || blocked || !valid || cost > g.budget || deal?.status === 'pending'}
        >
          <Send size={16} /> {deal ? '수정 조건 제안' : '계약 조건 제안'}
        </button>
        <small>제안 후 1~2일 내 답변</small>
      </div>
    </form>
  );
}
