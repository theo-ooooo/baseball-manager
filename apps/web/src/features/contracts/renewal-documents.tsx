'use client';
import { FileSignature, Send } from 'lucide-react';
import { money } from '@dugout/shared/game-view';
import type { GameState } from '@dugout/shared/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { useRenewalDraft } from './use-renewal-documents';

export function RenewalDocuments({
  g,
  act,
  busy,
  close,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  close: () => void;
}) {
  const { getClub } = useWorld();
  const form = useRenewalDraft(g, act, busy, close);
  const available = form.rows.filter((row) => !row.reason).length;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.locked) close();
      }}
    >
      <DialogContent className="renewal-documents-dialog" aria-modal="true">
        <DialogHeader className="renewal-documents-header">
          <small>
            {g.year} · {getClub(g.club).name}
          </small>
          <DialogTitle>
            <FileSignature size={22} /> 일괄 재계약 서류
          </DialogTitle>
          <DialogDescription>
            만료 예정 선수의 제안 조건을 확인하세요. 답변은 1~2일 뒤 도착하며, 합의 후 개별 서명하면
            계약이 체결됩니다. 재계약 기간은 {g.year + 1} 시즌부터 계산하며, 올 시즌도 소속을
            유지합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.send();
          }}
        >
          <div className="renewal-documents-scroll">
            <fieldset className="renewal-bulk-terms" disabled={form.locked}>
              <legend>선택한 선수의 조건 일괄 조정</legend>
              <label>
                현재 연봉 대비 (%)
                <input
                  type="number"
                  min="-99"
                  max="200"
                  step="1"
                  value={form.increase}
                  onChange={(e) => form.setIncrease(e.target.value)}
                />
              </label>
              <label>
                계약 기간
                <select
                  value={form.period}
                  onChange={(e) => form.setPeriod(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}년
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button secondary compact"
                disabled={!form.adjustmentValid || !form.selected.length}
                onClick={form.applyTerms}
              >
                조건 적용
              </button>
            </fieldset>
            <div className="renewal-selection-heading">
              <strong>
                선택 {form.selected.length} / {available}명
              </strong>
              <button
                type="button"
                className="text-button"
                disabled={form.locked || !available}
                onClick={() => form.selectAll(form.selected.length !== available)}
              >
                {form.selected.length === available ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="renewal-document-rows">
              {form.rows.map((row) => (
                <fieldset
                  key={row.player.id}
                  className={`renewal-document-row ${row.reason ? 'unavailable' : ''}`}
                  disabled={form.locked || !!row.reason}
                >
                  <legend className="sr-only">{row.player.name} 재계약 조건</legend>
                  <label className="renewal-document-player">
                    <input
                      type="checkbox"
                      checked={!row.reason && !!row.selected}
                      onChange={(e) => form.update(row.player.id, { selected: e.target.checked })}
                    />
                    <span>
                      <strong>{row.player.name}</strong>
                      <small>
                        {row.player.pos} · {row.player.age}세 · 현재 {money(row.player.salary)}
                      </small>
                    </span>
                  </label>
                  {row.reason ? (
                    <p>{row.reason}</p>
                  ) : (
                    <div className="renewal-document-terms">
                      <label>
                        제안 연봉 (만 원)
                        <input
                          aria-label={`${row.player.name} 제안 연봉 (만 원)`}
                          type="number"
                          min="1"
                          step="1"
                          required={row.selected}
                          disabled={!row.selected}
                          value={row.salary || ''}
                          onChange={(e) => form.update(row.player.id, { salary: e.target.value })}
                        />
                      </label>
                      <label>
                        계약 기간
                        <select
                          aria-label={`${row.player.name} 계약 기간`}
                          disabled={!row.selected}
                          value={row.years || 3}
                          onChange={(e) =>
                            form.update(row.player.id, { years: Number(e.target.value) })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}년
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </fieldset>
              ))}
            </div>
            {!available && (
              <p className="rule-notice">
                새로 제안할 만료 예정 선수가 없습니다. 진행 중인 협상에서 답변과 계약서를
                확인하세요.
              </p>
            )}
            <dl className="renewal-document-totals" aria-live="polite">
              <div>
                <dt>선택 선수의 제안 연봉 합계</dt>
                <dd>{money(form.valid ? form.annual : 0)}</dd>
              </div>
              <div>
                <dt>계약 기간 보장 총액</dt>
                <dd>{money(form.valid ? form.guaranteed : 0)}</dd>
              </div>
              <div>
                <dt>전원 체결 시 선수단 연봉</dt>
                <dd>
                  {money(
                    form.valid ? form.payroll : g.roster.reduce((sum, p) => sum + p.salary, 0),
                  )}
                </dd>
              </div>
              <div>
                <dt>계약금 5% + 수수료 합계</dt>
                <dd>{money(form.valid ? form.cost : 0)}</dd>
              </div>
            </dl>
            <p className="tiny">
              가용 예산 {money(g.budget)} · 위 비용은 제안 조건 기준입니다. 역제안 시 달라질 수
              있으며 서명할 때 지출됩니다.
            </p>
            {form.valid && form.cost > g.budget && (
              <p className="rule-notice">
                계약금과 수수료가 예산을 {money(form.cost - g.budget)} 초과합니다. 대상이나 조건을
                조정하세요.
              </p>
            )}
          </div>
          <footer className="renewal-documents-footer">
            <button
              type="button"
              className="button secondary"
              disabled={form.locked}
              onClick={close}
            >
              닫기
            </button>
            <button className="button primary" disabled={!form.canSend}>
              <Send size={16} />
              {form.locked ? '처리 중…' : `${form.selected.length}명에게 제안 발송`}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
