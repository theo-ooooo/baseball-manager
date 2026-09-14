'use client';
import { isPostseasonPhase } from '@dugout/shared/postseason';
import Link from 'next/link';
import { FileSignature, Handshake, PenLine, LockKeyhole } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { isUnemployed } from '@dugout/shared/manager-career';
import { money } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import { useManagerContractNegotiation } from './use-manager-contract-negotiation';
import { Choice } from '../../components/game-ui';
import type { Act } from './game-contracts';

type MoneyField = ReturnType<typeof useManagerContractNegotiation>['salary'];
function OfferMoneyField({
  label,
  field,
  disabled,
  baseline,
}: {
  label: string;
  field: MoneyField;
  disabled: boolean;
  baseline: number;
}) {
  return (
    <div className="manager-money-field">
      <strong>{label}</strong>
      <div className="manager-money-input">
        <input
          aria-label={label}
          inputMode="decimal"
          value={field.value}
          disabled={disabled}
          onChange={(e) => field.setValue(e.target.value)}
        />
        <select
          aria-label={`${label} 단위`}
          value={field.unit}
          disabled={disabled}
          onChange={(e) => field.changeUnit(e.target.value)}
        >
          <option>억 원</option>
          <option>만 원</option>
        </select>
      </div>
      <span>{Number.isFinite(field.amount) ? money(field.amount) : '금액을 입력해 주세요'}</span>
      <div className="manager-money-shortcuts" role="group" aria-label={`${label} 빠른 조정`}>
        {[-5, 5, 10, 20].map((pct) => (
          <button
            type="button"
            key={pct}
            disabled={disabled || baseline === 0}
            onClick={() => field.setAmount(baseline * (1 + pct / 100))}
          >
            {pct > 0 ? '+' : ''}
            {pct}%
          </button>
        ))}
      </div>
    </div>
  );
}
export function ManagerContractNegotiation({
  g,
  offer: o,
  act,
  busy,
}: {
  g: GameState;
  offer: ManagerOffer;
  act: Act;
  busy: boolean;
}) {
  const { getClub, clubs } = useWorld(),
    club = getClub(o.club);
  const {
    t,
    previous,
    current,
    salary,
    bonus,
    years,
    setYears,
    target,
    setTarget,
    signing,
    setSigning,
    ink,
    setInk,
    agreed,
    waiting,
    waitForReply,
    final,
    valid,
    changed,
    send,
    reset,
  } = useManagerContractNegotiation(g, o, act, busy);
  const maxRank = Math.min(o.targetRank + 2, clubs.filter((c) => c.league === club.league).length);
  const editable = !agreed && !final && !waiting;
  const reply = waiting
    ? `${t?.due}까지 이사회가 제안을 검토합니다.`
    : agreed
      ? '조건 합의가 완료되었습니다. 합의한 조건은 확정되었으며 최종 서명만 남았습니다.'
      : final
        ? '구단이 제시할 수 있는 최종 조건입니다. 배정된 예산을 더 늘릴 수 없습니다. 수락하거나 협상을 종료해 주세요.'
        : t?.status === 'counter'
          ? o.message
          : '구단의 제안을 바로 수락하거나 희망 조건을 제안하세요. 구단마다 협상할 수 있는 예산에 한도가 있습니다.';
  const delta = salary.amount - current.salary;
  const comparison = [
    ['시즌 연봉', money(current.salary), valid ? money(salary.amount) : '—'],
    ['계약금 · 1회', money(current.signingBonus), valid ? money(bonus.amount) : '—'],
    ['계약 기간', `${current.years}시즌`, `${years}시즌`],
    ['성적 목표', `${current.targetRank}위 이내`, `${target}위 이내`],
    [
      '보장 총액',
      money(current.salary * current.years + current.signingBonus),
      valid ? money(salary.amount * years + bonus.amount) : '—',
    ],
  ];
  return (
    <section className="contract-room manager-contract-room">
      <header className="contract-room-header">
        <span className="contract-room-icon">
          <Handshake size={24} />
        </span>
        <div>
          <small>{club.name} · 감독 고용 협상</small>
          <h2>계약 조건 조율</h2>
        </div>
        <span className="contract-status">
          {waiting
            ? '구단 검토 중'
            : agreed
              ? '조건 합의'
              : final
                ? '최종 제안'
                : `협상 ${Math.min(3, (t?.round || 0) + 1)} / 3`}
        </span>
      </header>
      <div className="manager-negotiation-content">
        <div className={`contract-reply ${final ? 'counter' : ''}`} aria-live="polite">
          <span>{agreed || final ? <LockKeyhole size={15} /> : null} 이사회 답변</span>
          <p>{reply}</p>
        </div>
        <div className="manager-offer-context">
          <span>
            답변 기한 <strong>{o.expires}</strong>
          </span>
          {o.expectation && (
            <span>
              {o.expectation.tier} · {o.expectation.reason}
            </span>
          )}
        </div>
        {!!o.budgetAdjustment && (
          <p className="rule-notice">
            취임 시 기준 운영 예산 {o.budgetAdjustment > 0 ? '10% 추가 지원' : '10% 절감'}에
            합의했습니다.
          </p>
        )}
        {previous && (
          <aside className="manager-previous-proposal">
            <strong>내가 보낸 직전 제안</strong>
            <dl>
              <div>
                <dt>연봉</dt>
                <dd>{money(previous.salary)}</dd>
              </div>
              <div>
                <dt>계약금</dt>
                <dd>{money(previous.signingBonus || 0)}</dd>
              </div>
              <div>
                <dt>기간 · 목표</dt>
                <dd>
                  {previous.years}시즌 · {previous.targetRank}위 이내
                </dd>
              </div>
            </dl>
          </aside>
        )}
        <div className="manager-offer-comparison">
          <table>
            <caption>
              {agreed
                ? '합의한 계약 조건'
                : final
                  ? '구단의 최종 제안'
                  : '구단 제안과 내 제안 비교'}
            </caption>
            <thead>
              <tr>
                <th scope="col">조건</th>
                <th scope="col">{agreed ? '합의 완료' : '구단 제안'}</th>
                {!agreed && !final && (
                  <th scope="col">{waiting ? '검토 중인 내 제안' : '내 제안'}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {comparison.map(([label, board, draft]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{board}</td>
                  {!agreed && !final && <td>{draft}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <>
            <div className="manager-proposal-title">
              <h3>희망 조건</h3>
              <button className="text-button" disabled={busy} onClick={reset}>
                구단 제안으로 되돌리기
              </button>
            </div>
            <div className="manager-proposal-grid">
              <OfferMoneyField
                label="희망 연봉"
                field={salary}
                disabled={busy}
                baseline={current.salary}
              />
              <OfferMoneyField
                label="희망 계약금"
                field={bonus}
                disabled={busy}
                baseline={current.signingBonus}
              />
              <div>
                <strong>계약 기간</strong>
                <div className="contract-year-options" role="group" aria-label="감독 계약 기간">
                  {[1, 2, 3].map((y) => (
                    <button
                      key={y}
                      disabled={busy}
                      aria-pressed={years === y}
                      onClick={() => setYears(y)}
                    >
                      {y}시즌
                    </button>
                  ))}
                </div>
              </div>
              <fieldset disabled={busy}>
                <Choice
                  label="계약 성적 목표"
                  value={target}
                  onChange={setTarget}
                  items={Array.from({ length: maxRank }, (_, i) => ({
                    value: String(i + 1),
                    label: `${i + 1}위 이내`,
                  }))}
                />
              </fieldset>
            </div>
            <p className="manager-proposal-delta" aria-live="polite">
              {valid
                ? `구단 제안 대비 연봉 ${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))} (${delta >= 0 ? '+' : ''}${((delta / current.salary) * 100).toFixed(1)}%) · 계약금은 체결 때 한 번 지급`
                : '연봉은 0보다 크게, 계약금은 0 이상으로 입력해 주세요. 제안 범위는 최초 연봉의 3배까지입니다.'}
            </p>
          </>
        )}
        <div className="manager-negotiation-actions">
          {editable && (
            <button
              className="button primary"
              disabled={busy || !valid || !changed}
              onClick={() => void send('negotiateManagerContract')}
            >
              수정 제안 보내기
            </button>
          )}
          {!waiting && !agreed && (
            <button
              className={`button ${final ? 'primary' : 'secondary'}`}
              disabled={busy}
              onClick={() => void send('acceptManagerTerms')}
            >
              {final ? '최종 조건 수락' : '구단 조건에 동의'}
            </button>
          )}
          {agreed && (
            <button className="button primary" disabled={busy} onClick={() => setSigning(true)}>
              <FileSignature size={17} />
              계약서 검토 · 서명
            </button>
          )}
          {waiting && (
            <>
              {g.phase === 'finished' && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void waitForReply()}
                >
                  하루 진행 · 이사회 답변 받기
                </button>
              )}
              <Link className="button secondary" href="/?view=inbox">
                수신함으로 · 답변 기다리기
              </Link>
            </>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void send('declineManager')}
          >
            제안 거절 · 협상 종료
          </button>
        </div>
        <p className="muted">조건 합의 후 최종 서명하면 취임합니다.</p>
        {!!t?.history.length && (
          <details className="interview-transcript">
            <summary>협상 기록 · {t.history.length}건</summary>
            {t.history.map((h, i) => (
              <div key={i}>
                <strong>
                  {h.date} · {h.speaker === 'board' ? '이사회' : g.manager}
                </strong>
                <p>{h.text}</p>
                <small>
                  연봉 {money(h.salary)} · 계약금 {money(h.signingBonus || 0)} · {h.years}시즌 ·{' '}
                  {h.targetRank}위 이내
                </small>
              </div>
            ))}
          </details>
        )}
      </div>
      {signing && agreed && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSigning(false);
          }}
        >
          <DialogContent
            className="contract-signing-dialog"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader className="contract-office-caption">
              <DialogTitle>구단 사무실 · 감독 계약서 작성</DialogTitle>
              <DialogDescription>
                합의한 조건을 확인하고 감독 서명 후 최종 체결하세요.
              </DialogDescription>
            </DialogHeader>
            <article className="contract-paper">
              <div className="contract-document-top">
                <span>DUGOUT / {g.year}</span>
                <span>{dateLabel(g)}</span>
              </div>
              <p className="contract-kicker">{club.name}</p>
              <h2>감독 고용 계약서</h2>
              <p className="contract-parties">
                {club.name} 구단과 <strong>{g.manager}</strong> 감독의 합의한 계약 조건입니다.
              </p>
              <dl className="contract-clauses">
                <div>
                  <dt>01 · 계약 대상</dt>
                  <dd>
                    {g.manager}
                    <small>1군 감독</small>
                  </dd>
                </div>
                <div>
                  <dt>02 · 보장 연봉</dt>
                  <dd>
                    {money(current.salary)}
                    <small>매 시즌 감독 급여</small>
                  </dd>
                </div>
                <div>
                  <dt>03 · 계약금</dt>
                  <dd>
                    {money(current.signingBonus)}
                    <small>체결 시 1회 지급 · 연봉과 별도</small>
                  </dd>
                </div>
                <div>
                  <dt>04 · 계약 기간</dt>
                  <dd>{current.years}시즌</dd>
                </div>
                <div>
                  <dt>05 · 성적 목표</dt>
                  <dd>{current.targetRank}위 이내</dd>
                </div>
              </dl>
              <p className="contract-budget">
                {isUnemployed(g)
                  ? '체결 후 구단의 현재 선수단과 시즌을 이어받습니다.'
                  : `체결과 동시에 ${getClub(g.club).name} 감독직을 마치고 새 구단에 취임합니다.`}
              </p>
              <div className="contract-signatures">
                <div>
                  <small>구단 대표</small>
                  <strong className="signature-name">{club.short} 이사회</strong>
                  <span>계약 조건 합의 완료</span>
                </div>
                <div>
                  <small>감독</small>
                  {ink ? (
                    <strong className="signature-name">{g.manager}</strong>
                  ) : (
                    <button className="signature-pad" disabled={busy} onClick={() => setInk(true)}>
                      <PenLine size={18} />
                      {g.manager} 서명하기
                    </button>
                  )}
                  <span>{ink ? '최종 체결을 기다립니다' : '서명란을 눌러 주세요'}</span>
                </div>
              </div>
            </article>
            <footer className="contract-signing-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setSigning(false)}
              >
                협상으로 돌아가기
              </button>
              <button
                className="button primary"
                disabled={busy || !ink || isPostseasonPhase(g.phase)}
                onClick={() => void send('signManager')}
              >
                <PenLine size={16} />
                {busy ? '계약 저장 중…' : '서명한 계약 최종 체결'}
              </button>
            </footer>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
