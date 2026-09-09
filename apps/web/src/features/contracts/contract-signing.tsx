'use client';
import { useState } from 'react';
import { Check, PenLine, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { fromManwon, money, toManwon } from '@dugout/shared/game-view';
import type { GameState } from '@dugout/shared/types';
import { dateLabel } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';
import { SalaryInput } from './salary-input';

export type Agreement = {
  name: string;
  role: string;
  salary: number;
  years: number;
  costs: { label: string; amount: number }[];
};
export function ContractSigning({
  agreement,
  g,
  busy,
  sign,
  reviseSalary,
  estimateCosts,
  close,
}: {
  agreement: Agreement;
  g: GameState;
  busy: boolean;
  sign: () => Promise<boolean>;
  reviseSalary: (salary: number) => Promise<boolean>;
  estimateCosts: (salary: number) => Agreement['costs'];
  close: () => void;
}) {
  const { getClub } = useWorld();
  const [ink, setInk] = useState(false),
    [signed, setSigned] = useState(false);
  const original = String(toManwon(agreement.salary));
  const [salary, setSalary] = useState(original);
  const changed = salary !== original;
  const amount = changed ? fromManwon(Number(salary)) : agreement.salary;
  const valid = salary.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= 1e8;
  const costs = changed && valid ? estimateCosts(amount) : agreement.costs;
  const total = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const changeSalary = (value: string) => {
    setSalary(value);
    setInk(false);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        className="contract-signing-dialog"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="contract-office-caption">
          <DialogTitle>
            {signed
              ? '계약 체결 완료'
              : changed
                ? '구단 사무실 · 연봉 조율'
                : '구단 사무실 · 계약서 작성'}
          </DialogTitle>
          <DialogDescription>
            {signed
              ? '서명이 완료되어 커리어에 저장되었습니다.'
              : '연봉을 조율해 다시 제안하거나 합의한 조건에 서명하세요.'}
          </DialogDescription>
        </DialogHeader>
        <article className={`contract-paper ${signed ? 'is-signed' : ''}`}>
          <div className="contract-document-top">
            <span>DUGOUT / {g.year}</span>
            <span>{dateLabel(g)}</span>
          </div>
          <p className="contract-kicker">{getClub(g.club).name}</p>
          <h2>{agreement.role} 계약서</h2>
          <p className="contract-parties">
            {getClub(g.club).name} 구단과 <strong>{agreement.name}</strong>의
            {changed
              ? ' 수정 계약 초안입니다. 변경한 연봉은 상대의 동의가 필요합니다.'
              : ' 합의한 계약 조건입니다.'}
          </p>
          <dl className="contract-clauses">
            <div>
              <dt>01 · 계약 대상</dt>
              <dd>
                {agreement.name} <small>{agreement.role}</small>
              </dd>
            </div>
            <div className="contract-salary-clause">
              <dt>02 · 보장 연봉</dt>
              <dd>
                {signed ? (
                  money(agreement.salary)
                ) : (
                  <>
                    <SalaryInput
                      value={salary}
                      onChange={changeSalary}
                      disabled={busy}
                      label="계약서 연봉 (만 원)"
                    />
                    <strong>{valid ? money(amount) : '유효한 연봉을 입력해 주세요'}</strong>
                    <small>상대가 합의한 연봉 {money(agreement.salary)}</small>
                    {changed && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => changeSalary(original)}
                      >
                        합의 연봉으로 되돌리기
                      </button>
                    )}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>03 · 계약 기간</dt>
              <dd>
                {agreement.years}년 <small>{g.year} 시즌부터</small>
              </dd>
            </div>
            {costs.map((cost, i) => (
              <div key={cost.label}>
                <dt>
                  {String(i + 4).padStart(2, '0')} · {cost.label}
                </dt>
                <dd>{valid ? money(cost.amount) : '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="contract-total">
            <span>{changed ? '수정 조건의 예상 지출' : '서명 시 총 지출'}</span>
            <strong>{valid ? money(total) : '—'}</strong>
          </div>
          {!signed && (
            <p className="contract-budget">
              계약 후 잔여 예산 <strong>{valid ? money(g.budget - total) : '—'}</strong>
            </p>
          )}
          {changed ? (
            <div className="contract-revision-note" role="status">
              <strong>연봉 조율 · 재합의 필요</strong>
              <p>
                수정 연봉을 제안하면 1~2일 뒤 답변이 도착합니다. 다시 합의한 뒤 새 계약서에 서명할
                수 있습니다.
              </p>
            </div>
          ) : (
            <div className="contract-signatures">
              <div>
                <small>선수 / 코치</small>
                <strong className="signature-name">{agreement.name}</strong>
                <span>계약 조건 합의 완료</span>
              </div>
              <div>
                <small>구단 대표 · 감독</small>
                {ink ? (
                  <strong className="signature-name">{g.manager}</strong>
                ) : (
                  <button className="signature-pad" onClick={() => setInk(true)} disabled={busy}>
                    <PenLine size={18} /> {g.manager} 서명하기
                  </button>
                )}
                <span>
                  {signed ? '체결 완료' : ink ? '최종 체결을 기다립니다' : '서명란을 눌러 주세요'}
                </span>
              </div>
            </div>
          )}
          {!signed && valid && total > g.budget && (
            <p className="rule-notice">
              가용 예산을 {money(total - g.budget)} 초과합니다. 연봉을 조정해 주세요.
            </p>
          )}
          {signed && (
            <div className="contract-seal" role="status">
              <Check size={20} /> 계약 체결 · 저장 완료
            </div>
          )}
        </article>
        <footer className="contract-signing-actions">
          <button className="button secondary" disabled={busy} onClick={close}>
            {signed ? '계약실 나가기' : '협상으로 돌아가기'}
          </button>
          {!signed && changed ? (
            <button
              className="button primary"
              disabled={busy || !valid || total > g.budget}
              onClick={async () => {
                if (await reviseSalary(amount)) {
                  toast.success('수정 연봉을 제안했습니다. 날짜를 진행하면 답변이 도착합니다.');
                  close();
                }
              }}
            >
              <Send size={16} /> {busy ? '제안 보내는 중…' : '수정 연봉 제안 · 답변 기다리기'}
            </button>
          ) : (
            !signed && (
              <button
                className="button primary"
                disabled={busy || !ink || total > g.budget}
                onClick={async () => {
                  if (await sign()) setSigned(true);
                }}
              >
                <PenLine size={16} />
                {busy ? '계약 저장 중…' : '서명한 계약 최종 체결'}
              </button>
            )
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
