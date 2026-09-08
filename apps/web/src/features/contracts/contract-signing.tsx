'use client';
import { useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { money } from '@dugout/shared/game-view';
import type { GameState } from '@dugout/shared/types';
import { dateLabel } from '@dugout/shared/calendar';
import { useWorld } from '../career/world-context';

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
  close,
}: {
  agreement: Agreement;
  g: GameState;
  busy: boolean;
  sign: () => Promise<boolean>;
  close: () => void;
}) {
  const { getClub } = useWorld();
  const [ink, setInk] = useState(false),
    [signed, setSigned] = useState(false);
  const total = agreement.costs.reduce((sum, cost) => sum + cost.amount, 0);
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
          <DialogTitle>{signed ? '계약 체결 완료' : '구단 사무실 · 최종 서명'}</DialogTitle>
          <DialogDescription>
            {signed
              ? '서명이 완료되어 커리어에 저장되었습니다.'
              : '합의한 조건을 확인하고 감독의 서명을 남겨 주세요.'}
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
            {getClub(g.club).name} 구단과 <strong>{agreement.name}</strong>은 다음 조건에
            합의합니다.
          </p>
          <dl className="contract-clauses">
            <div>
              <dt>01 · 계약 대상</dt>
              <dd>
                {agreement.name} <small>{agreement.role}</small>
              </dd>
            </div>
            <div>
              <dt>02 · 보장 연봉</dt>
              <dd>
                {money(agreement.salary)} <small>매 시즌</small>
              </dd>
            </div>
            <div>
              <dt>03 · 계약 기간</dt>
              <dd>
                {agreement.years}년 <small>{g.year} 시즌부터</small>
              </dd>
            </div>
            {agreement.costs.map((cost, i) => (
              <div key={cost.label}>
                <dt>
                  {String(i + 4).padStart(2, '0')} · {cost.label}
                </dt>
                <dd>{money(cost.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="contract-total">
            <span>서명 시 총 지출</span>
            <strong>{money(total)}</strong>
          </div>
          {!signed && (
            <p className="contract-budget">
              계약 후 잔여 예산 <strong>{money(g.budget - total)}</strong>
            </p>
          )}
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
          {!signed && (
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
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
