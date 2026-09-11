'use client';
import { Handshake, UserRound } from 'lucide-react';
import { dateLabel } from '@dugout/shared/calendar';
import { NegotiationHistory, negotiationLabels } from './negotiation-details';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, overall, money } from '@dugout/shared/game-view';
import { Rating, PlayerName } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';
import { RenewalDocuments } from '../contracts/renewal-documents';
import { useRenewalDocuments } from '../contracts/use-renewal-documents';

export function Agents({
  g,
  act,
  busy,
  onPlayer,
  onNegotiate,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onNegotiate: (p: Player) => void;
}) {
  const { agentFor } = useWorld();
  const documents = useRenewalDocuments();
  return (
    <>
      <div className="agent-intro">
        <Handshake size={28} />
        <div>
          <h3>계약 테이블</h3>
          <p>
            구단 이적 동의 → 개인 조건 협상 → 최종 계약. 답변은 날짜를 진행하면 수신함에 도착하며,
            수락·역제안은 도착 후 7일간 유효합니다. 최종 계약 전에는 비용이 지출되지 않습니다.
          </p>
        </div>
      </div>
      {g.roster.some((p) => p.years === 1) && (
        <div className="renewal-documents-launch">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => documents.setOpen(true)}
          >
            전체 재계약 서류 작성
          </button>
          <small>만료 예정 선수 선택 · 조건 일괄 조정 · 제안 발송</small>
        </div>
      )}
      {documents.open && (
        <RenewalDocuments g={g} act={act} busy={busy} close={() => documents.setOpen(false)} />
      )}
      {g.roster.some((p) => p.years === 1) && (
        <details className="contract-renewals" open={g.deals.length === 0}>
          <summary>
            이번 시즌 계약 만료 예정 · {g.roster.filter((p) => p.years === 1).length}명
          </summary>
          <div className="contract-renewal-grid">
            {g.roster
              .filter((p) => p.years === 1)
              .map((p) => (
                <div key={p.id}>
                  <div>
                    <button className="text-button" onClick={() => onPlayer(p)}>
                      {p.name}
                    </button>
                    <small>
                      {p.pos} · {p.age}세 · 연봉 {money(p.salary)}
                    </small>
                  </div>
                  <button
                    className="button secondary compact"
                    disabled={busy}
                    onClick={() => onNegotiate(p)}
                  >
                    {g.deals.some((d) => d.player.id === p.id) ? '협상 이어가기' : '재계약 협상'}
                  </button>
                </div>
              ))}
          </div>
        </details>
      )}
      {g.deals.length ? (
        <div className="deal-grid">
          {g.deals.map((d) => {
            const a = agentFor(d.player);
            const expired =
              d.status === 'expired' ||
              (d.year !== undefined && d.year !== g.year) ||
              g.day > (d.expires ?? d.day + 14);
            return (
              <section className="panel deal-card" key={d.id}>
                <div className="panel-header">
                  <span
                    className={`pill ${d.status === 'accepted' ? 'lime' : d.status === 'counter' ? 'amber' : ''}`}
                  >
                    {expired ? '제안 만료' : negotiationLabels[d.status]}
                  </span>
                  <span className="muted">{d.type === 'renew' ? '재계약' : '신규 영입'}</span>
                </div>
                <div className="panel-content">
                  <div className="deal-player">
                    <PlayerName p={d.player} onClick={onPlayer} />
                    <Rating value={overall(d.player)} player={d.player} />
                  </div>
                  <p className="agent-message">“{d.message}”</p>
                  <p className="tiny">
                    {d.stage === 'club' ? '1단계 · 소속 구단 협상' : '2단계 · 개인 계약 조건'}
                    {d.status === 'pending' && d.responseDay !== undefined
                      ? ` · ${dateLabel(g, d.responseDay)}까지 답변 예정`
                      : d.expires !== undefined
                        ? ` · ${dateLabel(g, d.expires)}까지 유효`
                        : ''}
                  </p>
                  {d.seller && (
                    <p className="tiny">
                      <strong>소속 구단 · {d.seller.role}</strong>
                      <br />
                      {d.seller.reason}
                    </p>
                  )}
                  <div className="agent-signature">
                    <span className="manager-avatar">
                      <UserRound size={19} />
                    </span>
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {a.agency} · 수수료 {(a.fee * 100).toFixed(0)}%
                      </small>
                    </span>
                  </div>
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
                      <small>이적료</small>
                      <strong>{money(d.fee)}</strong>
                    </div>
                  </div>
                  <div className="cost-line">
                    <span>서명 시 지출 · 계약금 5% + 수수료 + 이적료</span>
                    <strong>{money(d.fee + d.agentFee + d.salary * 0.05)}</strong>
                  </div>
                  <button
                    className="button primary full-width"
                    disabled={busy}
                    onClick={() => onNegotiate(d.player)}
                  >
                    {d.status === 'accepted' && !expired
                      ? '계약서 검토 · 서명'
                      : d.status === 'counter' && !expired
                        ? '역제안 확인 · 재협상'
                        : '협상실 열기'}
                  </button>
                  <NegotiationHistory history={d.history} g={g} />
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <div className="empty-state">
            <Handshake size={42} />
            <h3>진행 중인 협상이 없습니다</h3>
            <p>
              영입 · 이적에서 선수를 선택해 에이전트에게 제안하세요.
              <br />
              소속 선수의 상세 화면에서는 재계약을 제안할 수 있습니다.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
