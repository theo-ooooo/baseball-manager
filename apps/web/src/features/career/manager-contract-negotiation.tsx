'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSignature, Handshake, PenLine, UserRound } from 'lucide-react';
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
import { fromManwon, money, toManwon } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import { SalaryInput } from '../contracts/salary-input';
import { Choice } from '../../components/game-ui';
import type { Act } from './game-contracts';

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
    t = o.contractTerms,
    router = useRouter();
  const [salary, setSalary] = useState(String(toManwon(t?.salary ?? o.salary))),
    [years, setYears] = useState(t?.years || 1),
    [target, setTarget] = useState(String(t?.targetRank || o.targetRank)),
    [editing, setEditing] = useState(false),
    [signing, setSigning] = useState(false),
    [ink, setInk] = useState(false);
  const club = getClub(o.club),
    agreed = t?.status === 'agreed',
    waiting = t?.status === 'pending',
    amount = fromManwon(Number(salary)),
    valid = salary.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= o.salary * 3;
  const maxRank = Math.min(o.targetRank + 2, clubs.filter((c) => c.league === club.league).length);
  const reply = waiting
    ? `${t.due}까지 이사회가 제안을 검토합니다.`
    : agreed
      ? '계약 조건에 합의했습니다. 최종 계약서를 확인하고 서명해 주세요.'
      : t?.status === 'counter'
        ? '이사회가 수정된 조건을 보내왔습니다. 동의하거나 다시 제안할 수 있습니다.'
        : '구단의 최초 제안입니다. 조건을 검토하고 협상을 시작하세요.';
  return (
    <section className="contract-room manager-contract-room">
      <header className="contract-room-header">
        <span className="contract-room-icon">
          <Handshake size={24} />
        </span>
        <div>
          <small>{club.name} · 감독 고용 협상</small>
          <h2>
            {g.manager}
            <span>감독</span>
          </h2>
        </div>
        <span className="contract-status">
          {waiting
            ? '구단 검토 중'
            : agreed
              ? '조건 합의'
              : t?.status === 'counter'
                ? '구단 역제안'
                : '최초 제안'}
        </span>
      </header>
      <ol className="contract-steps">
        {['조건 협상', '조건 합의', '최종 서명'].map((label, i) => (
          <li
            key={label}
            className={i === (agreed ? 2 : 0) ? 'current' : agreed ? 'done' : ''}
            aria-current={i === (agreed ? 2 : 0) ? 'step' : undefined}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="contract-room-body">
        <aside className="contract-agent">
          <div className="contract-agent-avatar">
            <UserRound size={30} />
          </div>
          <small>구단 측 협상 담당</small>
          <h3>{club.name} 이사회</h3>
          <p>감독 선임 및 고용 계약</p>
          <div className="contract-agent-note">
            <strong>구단의 현재 조건</strong>
            <p>{money(t?.salary ?? o.salary)} / 시즌</p>
            <p>
              {t?.years || 1}시즌 · {t?.targetRank || o.targetRank}위 이내
            </p>
          </div>
          <div className="contract-agent-note">
            <strong>답변 기한</strong>
            <p>{o.expires}</p>
            <small>최종 서명 전까지 현재 신분을 유지합니다.</small>
          </div>
        </aside>
        <div className="contract-discussion">
          <div
            className={`contract-reply ${t?.status === 'counter' ? 'counter' : ''}`}
            aria-live="polite"
          >
            <span>이사회 브리핑</span>
            <p>{reply}</p>
          </div>
          {!!o.budgetAdjustment && (
            <p className="rule-notice">
              취임 시 기준 운영 예산 {o.budgetAdjustment > 0 ? '10% 추가 지원' : '10% 절감'}에
              합의했습니다.
            </p>
          )}
          {agreed && !editing ? (
            <>
              <h3>합의한 고용 조건</h3>
              <dl className="contract-term-summary">
                <div>
                  <dt>감독 연봉</dt>
                  <dd>{money(t.salary)}</dd>
                </div>
                <div>
                  <dt>계약 기간</dt>
                  <dd>{t.years}시즌</dd>
                </div>
                <div>
                  <dt>성적 목표</dt>
                  <dd>{t.targetRank}위 이내</dd>
                </div>
              </dl>
              <div className="contract-room-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  조건 다시 조정
                </button>
                <button className="button primary" disabled={busy} onClick={() => setSigning(true)}>
                  <FileSignature size={17} />
                  계약서 검토 · 서명
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="contract-proposal-heading">
                <h3>감독의 수정 제안</h3>
                <small>구단의 조건과 비교하며 조율하세요</small>
              </div>
              <div className="contract-term-row">
                <div>
                  <strong>희망 연봉</strong>
                  <small>현재 제안 {money(t?.salary ?? o.salary)}</small>
                  <strong>{valid ? money(amount) : '연봉을 확인해 주세요'}</strong>
                </div>
                <SalaryInput
                  value={salary}
                  onChange={setSalary}
                  disabled={busy || waiting}
                  label="희망 감독 연봉 (만 원)"
                />
              </div>
              <div className="contract-term-row">
                <div>
                  <strong>계약 기간</strong>
                  <small>현재 제안 {t?.years || 1}시즌</small>
                </div>
                <div className="contract-year-options" role="group" aria-label="감독 계약 기간">
                  {[1, 2, 3].map((y) => (
                    <button
                      key={y}
                      disabled={busy || waiting}
                      aria-pressed={years === y}
                      onClick={() => setYears(y)}
                    >
                      {y}시즌
                    </button>
                  ))}
                </div>
              </div>
              <div className="contract-term-row">
                <div>
                  <strong>성적 목표</strong>
                  <small>현재 제안 {t?.targetRank || o.targetRank}위 이내</small>
                </div>
                <fieldset disabled={busy || waiting}>
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
              <div className="contract-room-actions">
                <button
                  className="button primary"
                  disabled={busy || waiting || !valid || (t?.round || 0) >= 4}
                  onClick={() =>
                    void act({
                      type: 'negotiateManagerContract',
                      id: o.id,
                      termsVersion: t?.version || 1,
                      salary: amount,
                      years,
                      targetRank: Number(target),
                    })
                  }
                >
                  수정 제안 보내기
                </button>
                <button
                  className="button secondary"
                  disabled={busy || waiting}
                  onClick={() =>
                    void act({
                      type: 'acceptManagerTerms',
                      id: o.id,
                      termsVersion: t?.version || 1,
                    })
                  }
                >
                  구단 조건에 동의
                </button>
              </div>
              <p className="muted">조건 합의 후 최종 계약서에 서명하면 취임합니다.</p>
            </>
          )}
          {waiting && (
            <Link className="button secondary contract-leave" href="/?view=inbox">
              협상실 나가기 · 답변 기다리기
            </Link>
          )}
          <button
            className="text-button contract-withdraw"
            disabled={busy}
            onClick={() => void act({ type: 'declineManager', id: o.id })}
          >
            채용 제안 거절 · 협상 철회
          </button>
          {!!t?.history.length && (
            <details className="interview-transcript">
              <summary>계약 협상 기록 · {t.history.length}건</summary>
              {t.history.map((h, i) => (
                <div key={i}>
                  <strong>
                    {h.date} · {h.speaker === 'board' ? '이사회' : g.manager}
                  </strong>
                  <p>{h.text}</p>
                  <small>
                    {money(h.salary)} · {h.years}시즌 · {h.targetRank}위 이내
                  </small>
                </div>
              ))}
            </details>
          )}
        </div>
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
                    {money(t.salary)}
                    <small>매 시즌 감독 급여</small>
                  </dd>
                </div>
                <div>
                  <dt>03 · 계약 기간</dt>
                  <dd>{t.years}시즌</dd>
                </div>
                <div>
                  <dt>04 · 성적 목표</dt>
                  <dd>{t.targetRank}위 이내</dd>
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
                disabled={busy || !ink || ['semifinal', 'final'].includes(g.phase)}
                onClick={async () => {
                  if (
                    await act({
                      type: 'signManager',
                      id: o.id,
                      termsVersion: t.version,
                      signature: g.manager,
                    })
                  )
                    router.push('/?view=home');
                }}
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
