'use client';
import { playerClubStanding } from '@dugout/shared/trade-policy';
import { usePlayerContractRoom } from './use-player-contract-room';
import Link from 'next/link';
import { Clock3, FileSignature, Handshake, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { playerPersonalityLabels } from '@dugout/shared/personality';
import { money } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import { transfersBlocked } from '@dugout/shared/management';
import { useWorld } from '../career/world-context';
import { NegotiationHistory, negotiationLabels } from '../market/negotiation-details';
import { ContractSigning } from './contract-signing';
import { playerDealPeriod } from '@dugout/shared/contract-status';
import { PlayerContractPeriod } from './player-contract-period';

import { PlayerOfferForm } from './player-offer-form';
import type { PlayerContractProps as Props } from './contract-types';

export function PlayerContractDialog({ close, ...props }: Props & { close: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.busy) close();
      }}
    >
      <DialogContent className="contract-room-dialog">
        <DialogHeader className="sr-only">
          <DialogTitle>{props.player.name} 계약 협상</DialogTitle>
          <DialogDescription>
            에이전트와 조건을 협의하고 합의 후 계약서에 서명합니다.
          </DialogDescription>
        </DialogHeader>
        <PlayerContractRoom {...props} onWait={close} />
      </DialogContent>
    </Dialog>
  );
}
export function PlayerContractRoom({
  player: requested,
  g,
  act,
  busy,
  onWait,
}: Props & { onWait?: () => void }) {
  const { agentFor, getClub, rosterFor } = useWorld();
  const {
    player,
    own,
    deal,
    found,
    editingId,
    setEditingId,
    signing,
    setSigning,
    completed,
    sign,
  } = usePlayerContractRoom(g, requested, act, onWait);
  const agent = agentFor(player);
  const expired =
    !!deal &&
    (deal.status === 'expired' ||
      (deal.year !== undefined && deal.year !== g.year) ||
      g.day > (deal.expires ?? deal.day + 14));
  const active = !!deal && !expired && !['withdrawn', 'rejected'].includes(deal.status);
  const editing = !active || editingId === deal?.id;
  const blocked = !own && transfersBlocked(g);
  const international =
    !own && player.club !== 'fa' && getClub(player.club)?.league !== getClub(g.club)?.league;
  const steps =
    own || player.club === 'fa'
      ? ['조건 제안', '답변·재협상', '최종 서명']
      : international
        ? ['국제 이적 제안', '구단 답변', '최종 계약']
        : ['트레이드 제안', '구단 답변', '최종 확정'];
  const current =
    deal?.status === 'accepted' && !expired ? 2 : deal && deal.stage !== 'club' ? 1 : 0;
  if (!found || g.managerCareer?.status === 'unemployed')
    return (
      <section className="contract-room panel-content">
        <h2>{player.name} · 계약 정보</h2>
        <p>
          {!found
            ? '현재 선수 기록을 찾을 수 없습니다.'
            : '소속 구단의 감독만 계약을 협상할 수 있습니다.'}
        </p>
      </section>
    );
  const standing = playerClubStanding(player, own ? g.roster : rosterFor(g, player.club));
  if (completed)
    return (
      <section className="contract-room panel-content">
        <h2>{player.name} · 계약 체결 완료</h2>
        <p>
          연봉 {money(player.salary)} · {player.years}년 계약
        </p>
        <p>이번 시즌 계약을 마쳤습니다. 새 조건은 선수 정보에 반영되었습니다.</p>
        {onWait && (
          <button className="button primary" onClick={onWait}>
            닫기
          </button>
        )}
      </section>
    );
  if (!own && player.club !== 'fa' && !international)
    return (
      <section className="player-trade-overview">
        <small>구단 간 트레이드</small>
        <h2>
          {player.name} · {getClub(player.club)?.name} 소속
        </h2>
        <p>
          연봉 {money(player.salary)} · 계약 {player.years}년 남음
        </p>
        <p>
          타 구단 소속 선수에게는 직접 연봉 협상을 제안할 수 없습니다. 계약 조건을 승계하는 구단 간
          트레이드로 영입하거나, 자유계약 신분이 된 뒤 협상하세요.
        </p>
        <div className="player-trade-standing">
          <strong>{standing.label}</strong>
          <p>{standing.reason}</p>
          <small>게임 내 전력과 잔류 성향을 바탕으로 한 구단 평가입니다.</small>
        </div>
        {getClub(player.club)?.league === getClub(g.club)?.league ? (
          <Link
            className="button primary"
            href={`/?view=trade&target=${encodeURIComponent(player.id)}`}
          >
            트레이드 제안 준비 →
          </Link>
        ) : (
          <p className="muted">현재 트레이드는 같은 리그 구단 간에 지원합니다.</p>
        )}
      </section>
    );
  return (
    <section className={`contract-room ${own ? 'renewal-room' : ''}`}>
      <header className="contract-room-header">
        <span className="contract-room-icon">
          <Handshake size={24} />
        </span>
        <div>
          <small>
            {getClub(g.club).name} · {own ? '선수 재계약' : '선수 영입 협상'}
          </small>
          <h2>
            {player.name}
            <span>
              {player.age}세 · {player.pos}
            </span>
          </h2>
        </div>
        <span className="contract-status">
          {deal ? (expired ? '제안 만료' : negotiationLabels[deal.status]) : '협상 준비'}
        </span>
      </header>
      <ol className="contract-steps">
        {steps.map((step, i) => (
          <li
            key={step}
            className={i === current ? 'current' : i < current ? 'done' : ''}
            aria-current={i === current ? 'step' : undefined}
          >
            <span>{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="contract-room-body">
        <aside className="contract-agent">
          <div className="contract-agent-avatar">
            <UserRound size={30} />
          </div>
          <small>선수 측 에이전트</small>
          <h3>{agent.name}</h3>
          <p>{agent.agency}</p>
          <span className="pill">{agent.priority}</span>
          <div className="player-personality-tags">
            {playerPersonalityLabels(player).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="contract-agent-note">
            <strong>{player.club === 'fa' ? '직전 계약 연봉' : '현재 계약'}</strong>
            <p>{money(player.salary)} / 시즌</p>
            <p>
              {player.club === 'fa' ? (
                '현재 소속 없음 · 새 계약 협상 가능'
              ) : (
                <>
                  {player.years}년 남음 · {own ? '소속 선수' : getClub(player.club)?.name}
                </>
              )}
            </p>
          </div>
          <div className="contract-agent-note">
            <strong>구단 가용 예산</strong>
            <p>{money(g.budget)}</p>
            <small>최종 서명 때 계약금과 에이전트 수수료가 반영됩니다.</small>
          </div>
        </aside>
        <div className="contract-discussion">
          <div
            className={`contract-reply ${deal?.status === 'counter' ? 'counter' : ''}`}
            aria-live="polite"
          >
            <span>{deal?.stage === 'club' ? '소속 구단과의 협의' : '에이전트 브리핑'}</span>
            <p>
              {deal?.message ||
                '선수의 역할과 구단 예산을 검토한 뒤 연봉과 계약 기간을 제안해 주세요. 조건을 검토하고 답변드리겠습니다.'}
            </p>
            {active && (
              <small>
                {deal.status === 'pending'
                  ? `${dateLabel(g, deal.responseDay ?? g.day + 1)}까지 답변 예정 · 상단 진행으로 날짜를 넘겨 주세요.`
                  : `${dateLabel(g, deal.expires ?? deal.day + 14)}까지 유효`}
              </small>
            )}
          </div>
          {deal?.history?.length ? (
            <div className="contract-previous-offer" aria-label="이전 제안 비교">
              <div>
                <small>내가 마지막으로 제안한 조건</small>
                <strong>
                  {money(
                    (deal.history.findLast((h) => h.side === 'club') || deal.history[0]).salary,
                  )}
                </strong>
                <span>
                  {(deal.history.findLast((h) => h.side === 'club') || deal.history[0]).years}년
                  계약
                </span>
              </div>
              <div>
                <small>{deal.status === 'pending' ? '상대 답변 대기' : '상대의 현재 조건'}</small>
                <strong>{deal.status === 'pending' ? '검토 중' : money(deal.salary)}</strong>
                <span>
                  {deal.status === 'pending' ? '아직 확정되지 않았습니다.' : `${deal.years}년 계약`}
                </span>
              </div>
            </div>
          ) : null}
          {blocked && <p className="rule-notice">첫 시즌 외부 영입 금지 조건입니다.</p>}
          {editing ? (
            <PlayerOfferForm
              key={deal?.id || player.id}
              {...{ player, g, act, busy, deal, own, blocked }}
              onSent={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="contract-proposal-heading">
                <h3>{deal.status === 'counter' ? '상대의 역제안' : '현재 협상 조건'}</h3>
                <small>연봉 · 기간 · 계약 비용</small>
              </div>
              <dl className="contract-term-summary">
                <div>
                  <dt>보장 연봉</dt>
                  <dd>{money(deal.salary)}</dd>
                </div>
                <div>
                  <dt>계약 기간</dt>
                  <dd>{deal.years}년</dd>
                </div>
                <div>
                  <dt>계약금 · 연봉의 5%</dt>
                  <dd>{money(deal.salary * 0.05)}</dd>
                </div>
                <div>
                  <dt>보장 연봉 총액</dt>
                  <dd>{money(deal.salary * deal.years)}</dd>
                </div>
                <div>
                  <dt>계약금 · 수수료 포함 지출</dt>
                  <dd>{money(deal.fee + deal.agentFee + deal.salary * 0.05)}</dd>
                </div>
              </dl>
              <PlayerContractPeriod year={g.year} type={deal.type} years={deal.years} />
              <div className="contract-room-actions">
                {deal.status === 'pending' ? (
                  <p className="contract-wait">
                    <Clock3 size={18} /> 상대가 제안을 검토하고 있습니다.
                  </p>
                ) : (
                  <>
                    <button
                      className="button secondary"
                      disabled={busy || (deal.deferredDays ?? 0) >= 28}
                      onClick={() => void act({ type: 'deferDeal', id: deal.id })}
                    >
                      계약 일주일 미루기
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => setEditingId(deal.id)}
                    >
                      조건 조정 · 재협상
                    </button>
                    {deal.status === 'counter' && (
                      <button
                        className="button primary"
                        disabled={busy || blocked}
                        onClick={() => void act({ type: 'acceptDealCounter', id: deal.id })}
                      >
                        역제안 수락{deal.stage === 'club' ? ' · 개인 협상으로' : ''}
                      </button>
                    )}
                    {deal.status === 'accepted' && (
                      <button
                        className="button primary"
                        disabled={busy || blocked}
                        onClick={() => setSigning(deal)}
                      >
                        <FileSignature size={17} /> 계약서 검토 · 서명
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {deal?.status === 'pending' &&
            (onWait ? (
              <button className="button secondary contract-leave" disabled={busy} onClick={onWait}>
                협상실 나가기 · 답변 기다리기
              </button>
            ) : (
              <Link className="button secondary contract-leave" href="/?view=inbox">
                수신함에서 답변 기다리기
              </Link>
            ))}
          {deal && (
            <>
              <NegotiationHistory history={deal.history} g={g} />
              {!['withdrawn', 'expired'].includes(deal.status) && (
                <button
                  className="text-button contract-withdraw"
                  disabled={busy}
                  onClick={async () => {
                    if (await act({ type: 'withdrawDeal', id: deal.id })) setEditingId(null);
                  }}
                >
                  협상 철회
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {signing && (
        <ContractSigning
          key={signing.id}
          agreement={{
            name: signing.player.name,
            role: signing.type === 'renew' ? '선수 재계약' : '선수 영입',
            salary: signing.salary,
            years: signing.years,
            startYear: playerDealPeriod(g.year, signing.type, signing.years).startYear,
            costs: [
              { label: '계약금 · 연봉의 5%', amount: signing.salary * 0.05 },
              { label: '에이전트 수수료', amount: signing.agentFee },
              ...(signing.fee > 0 ? [{ label: '구단 간 지급액', amount: signing.fee }] : []),
            ],
          }}
          g={g}
          busy={busy}
          sign={sign}
          reviseSalary={async (salary) =>
            !!(await act({ type: 'reviseContractSalary', kind: 'player', id: signing.id, salary }))
          }
          estimateCosts={(salary) => [
            { label: '계약금 · 연봉의 5%', amount: salary * 0.05 },
            { label: '에이전트 수수료', amount: Math.round(salary * agent.fee) },
            ...(signing.fee > 0 ? [{ label: '구단 간 지급액', amount: signing.fee }] : []),
          ]}
          close={() => setSigning(null)}
        />
      )}
    </section>
  );
}
