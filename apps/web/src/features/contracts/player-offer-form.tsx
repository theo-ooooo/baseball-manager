'use client';
import { usePlayerOffer } from './use-player-offer';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Deal } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import type { PlayerContractProps as Props } from './contract-types';
import { PlayerContractPeriod } from './player-contract-period';

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
    quote,
    error,
    loading,
    retry,
  } = usePlayerOffer(player, g, deal, own);
  const clubCounter =
    !own && player.club !== 'fa' && deal?.stage === 'club' && deal.status === 'counter';
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
        <h3>{own ? '다음 계약을 제안해 보세요' : '우리 구단의 제안'}</h3>
        <small>금액 단위: 만 원</small>
      </div>
      {!own && player.club === 'fa' && (
        <div className="contract-reply" aria-live="polite">
          <strong>
            {quote
              ? `에이전트 요구 연봉 ${money(quote.salary)} · ${quote.years}년`
              : loading
                ? 'FA 요구 조건 확인 중…'
                : 'FA 요구 조건'}
          </strong>
          <p>
            {quote?.basis || error || '현재 선수 가치와 영입할 리그를 기준으로 조건을 확인합니다.'}
          </p>
          {quote && <small>직전 연봉과 별도로 평가한 새 계약 요구액입니다.</small>}
          {error && (
            <button type="button" className="text-button" onClick={retry}>
              다시 불러오기
            </button>
          )}
        </div>
      )}
      <div className="contract-term-row">
        <label htmlFor={`salary-${player.id}`}>
          보장 연봉
          <small>
            {player.club === 'fa' ? '직전' : '현재'} {money(player.salary)}
          </small>
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
      <PlayerContractPeriod year={g.year} type={own ? 'renew' : 'buy'} years={years} />
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
      <section className="renewal-cost-overview" aria-label="새 계약 비용">
        <div>
          <small>보장 연봉 총액 · {years}년</small>
          <strong>{money(valid ? amount * years : 0)}</strong>
        </div>
        <div>
          <small>계약금 · 연봉의 5%</small>
          <strong>{money(valid ? amount * 0.05 : 0)}</strong>
        </div>
        <div>
          <small>에이전트 수수료</small>
          <strong>{money(valid ? agentFee : 0)}</strong>
        </div>
        <div>
          <small>서명할 때 구단에서 지출</small>
          <strong>{money(valid ? cost : 0)}</strong>
        </div>
      </section>
      <p className="renewal-salary-change">
        {player.club === 'fa' ? '직전 연봉 대비' : '현재 연봉 대비'}{' '}
        {Number.isFinite(amount) && player.salary > 0
          ? `${(amount / player.salary - 1) * 100 >= 0 ? '+' : ''}${((amount / player.salary - 1) * 100).toFixed(1)}%`
          : '—'}{' '}
        · 연봉은 시즌 중 급여로 별도 정산합니다.
      </p>
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
          <Send size={16} />
          {clubCounter
            ? '이적료 수락 · 선수 조건 제안'
            : deal
              ? '수정 조건 제안'
              : '계약 조건 제안'}
        </button>
        <small>
          {clubCounter ? '이적료를 수락하면 선수 측 협상으로 넘어갑니다.' : '제안 후 1~2일 내 답변'}
        </small>
      </div>
    </form>
  );
}
