'use client';
import { useState } from 'react';
import { ContractSigning } from '../contracts/contract-signing';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Coach, CoachDeal, GameState } from '@dugout/shared/types';
import { coachRoles, fromManwon, money, toManwon } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { NegotiationHistory, negotiationLabels } from '../market/negotiation-details';
import type { Act } from '../career/game-contracts';
type Props = { g: GameState; act: Act; busy: boolean };

export function CoachOfferDialog({
  coach,
  role: initialRole,
  g,
  act,
  busy,
  close,
}: Props & { coach: Coach; role: string; close: () => void }) {
  const previous = g.coachDeals?.find((d) => d.coach.id === coach.id);
  const [role, setRole] = useState(previous?.role || (coach.real ? initialRole : coach.role));
  const [salary, setSalary] = useState(String(toManwon(previous?.salary || coach.salary * 1.1)));
  const [years, setYears] = useState(previous?.years || 2);
  const amount = fromManwon(Number(salary));
  const outgoing = g.staff.find((c) => c.role === role);
  const compensation = outgoing?.contractUntil
    ? outgoing.salary * Math.max(0, outgoing.contractUntil - g.year) * 0.25
    : 0;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="negotiation-dialog">
        <DialogHeader>
          <DialogTitle>{coach.name} · 코치 계약 제안</DialogTitle>
          <DialogDescription>
            보직·연봉·기간을 제안하면 1~2일 안에 답변이 도착합니다. 최종 계약까지 기존 코치는
            유지됩니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ type: 'coachOffer', id: coach.id, role, salary: amount, years })) {
              toast.success('코치에게 제안을 보냈습니다. 날짜를 진행해 답변을 기다리세요.');
              close();
            }
          }}
        >
          <div className="contract-inputs">
            <label>
              담당 보직
              <select value={role} disabled={!coach.real} onChange={(e) => setRole(e.target.value)}>
                {coachRoles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              제안 연봉 (만 원)
              <input
                type="number"
                min="1"
                required
                step="1"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
              <small>{money(amount || 0)} / 시즌</small>
            </label>
            <label>
              계약 기간
              <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}년
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="contract-costs">
            <div>
              <span>교체 대상</span>
              <strong>{outgoing?.name || '공석'}</strong>
            </div>
            <div>
              <span>계약금 · 연봉의 10%</span>
              <strong>{money(amount * 0.1 || 0)}</strong>
            </div>
            <div>
              <span>기존 계약 보상금</span>
              <strong>{money(compensation)}</strong>
            </div>
            <div>
              <span>구단 예산</span>
              <strong>{money(g.budget)}</strong>
            </div>
          </div>
          {compensation > 0 && (
            <p className="tiny">현재 계약의 잔여 시즌 연봉 25%를 교체 보상금으로 지급합니다.</p>
          )}
          <div className="negotiation-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={close}>
              취소
            </button>
            <button
              className="button primary"
              disabled={
                busy || !Number.isFinite(amount) || amount <= 0 || previous?.status === 'pending'
              }
            >
              계약 조건 제안
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CoachNegotiations({
  g,
  act,
  busy,
  onOffer,
}: Props & { onOffer: (coach: Coach) => void }) {
  const [signing, setSigning] = useState<CoachDeal | null>(null);
  if (!g.coachDeals?.length && !signing) return null;
  return (
    <section className="coach-negotiations">
      <h2>코치 협상</h2>
      <div className="deal-grid">
        {g.coachDeals?.map((d) => {
          const expired =
            d.year !== g.year || g.day > (d.expires ?? d.day + 14) || d.status === 'expired';
          return (
            <section className="panel deal-card" key={d.id}>
              <div className="panel-header">
                <h3>
                  {d.coach.name} · {d.role}
                </h3>
                <span className={`pill ${d.status === 'counter' ? 'amber' : ''}`}>
                  {expired ? '제안 만료' : negotiationLabels[d.status]}
                </span>
              </div>
              <div className="panel-content">
                <p className="agent-message">{d.message}</p>
                <p className="tiny">
                  {d.status === 'pending' && d.responseDay !== undefined
                    ? `${dateLabel(g, d.responseDay)}까지 답변 예정`
                    : d.expires !== undefined
                      ? `${dateLabel(g, d.expires)}까지 유효`
                      : ''}
                </p>
                <div className="deal-terms">
                  <div>
                    <small>연봉</small>
                    <strong>{money(d.salary)}</strong>
                  </div>
                  <div>
                    <small>계약 기간</small>
                    <strong>{d.years}년</strong>
                  </div>
                  <div>
                    <small>교체 대상</small>
                    <strong>{g.staff.find((c) => c.id === d.replacesId)?.name || '공석'}</strong>
                  </div>
                </div>
                <div className="cost-line">
                  <span>계약금 + 기존 코치 보상금</span>
                  <strong>{money(d.salary * 0.1 + d.compensation)}</strong>
                </div>
                {d.status === 'counter' && !expired && (
                  <button
                    className="button primary full-width"
                    disabled={busy}
                    onClick={() => void act({ type: 'acceptCoachCounter', id: d.id })}
                  >
                    역제안 수락
                  </button>
                )}
                {d.status === 'accepted' && !expired && (
                  <button
                    className="button primary full-width"
                    disabled={busy}
                    onClick={() => setSigning(d)}
                  >
                    계약서 검토 · 서명
                  </button>
                )}
                <div className="negotiation-actions">
                  {d.status !== 'pending' && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => onOffer(d.coach)}
                    >
                      조건 수정 · 다시 제안
                    </button>
                  )}
                  {!['withdrawn', 'expired'].includes(d.status) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void act({ type: 'withdrawCoach', id: d.id })}
                    >
                      협상 철회
                    </button>
                  )}
                </div>
                <NegotiationHistory g={g} history={d.history} />
              </div>
            </section>
          );
        })}
      </div>
      {signing && (
        <ContractSigning
          key={signing.id}
          agreement={{
            name: signing.coach.name,
            role: `${signing.role} 코치`,
            salary: signing.salary,
            years: signing.years,
            costs: [
              { label: '계약금 · 연봉의 10%', amount: signing.salary * 0.1 },
              { label: '기존 코치 계약 보상금', amount: signing.compensation },
            ],
          }}
          g={g}
          busy={busy}
          sign={async () => !!(await act({ type: 'signCoach', id: signing.id }))}
          reviseSalary={async (salary) =>
            !!(await act({ type: 'reviseContractSalary', kind: 'coach', id: signing.id, salary }))
          }
          estimateCosts={(salary) => [
            { label: '계약금 · 연봉의 10%', amount: salary * 0.1 },
            { label: '기존 코치 계약 보상금', amount: signing.compensation },
          ]}
          close={() => setSigning(null)}
        />
      )}
    </section>
  );
}
