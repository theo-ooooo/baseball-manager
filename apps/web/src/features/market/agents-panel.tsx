'use client';
import { Check, Handshake, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useWorld } from '../career/world-context';
import { type GameState, type Player, overall, money } from '@dugout/shared/game-view';
import { transfersBlocked } from '@dugout/shared/management';
import { Rating, PlayerName } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';

export function Agents({
  g,
  act,
  busy,
  onPlayer,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
}) {
  const { agentFor } = useWorld();
  return (
    <>
      <div className="agent-intro">
        <Handshake size={28} />
        <div>
          <h3>계약 테이블</h3>
          <p>
            수락된 조건이나 역제안에 최종 서명하면 이적료·계약금·수수료가 지출됩니다. 제안은 14일간
            유효합니다.
          </p>
        </div>
      </div>
      {g.deals.length ? (
        <div className="deal-grid">
          {g.deals.map((d) => {
            const a = agentFor(d.player);
            return (
              <section className="panel deal-card" key={d.id}>
                <div className="panel-header">
                  <span
                    className={`pill ${d.status === 'accepted' ? 'lime' : d.status === 'counter' ? 'amber' : ''}`}
                  >
                    {d.status === 'accepted'
                      ? '계약 합의'
                      : d.status === 'counter'
                        ? '역제안 도착'
                        : '제안 거절'}
                  </span>
                  <span className="muted">{d.type === 'renew' ? '재계약' : '신규 영입'}</span>
                </div>
                <div className="panel-content">
                  <div className="deal-player">
                    <PlayerName p={d.player} onClick={onPlayer} />
                    <Rating value={overall(d.player)} player={d.player} />
                  </div>
                  <p className="agent-message">“{d.message}”</p>
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
                    <span>지금 지출 · 계약금 15% + 수수료 + 이적료</span>
                    <strong>{money(d.fee + d.agentFee + d.salary * 0.15)}</strong>
                  </div>
                  <button
                    className="button primary full-width"
                    disabled={
                      busy ||
                      d.status === 'rejected' ||
                      g.day - d.day > 14 ||
                      (d.type === 'buy' && transfersBlocked(g))
                    }
                    onClick={async () => {
                      if (await act({ type: 'sign', id: d.id }))
                        toast.success('계약에 서명했습니다. 선수단에서 확인하세요.');
                    }}
                  >
                    {g.day - d.day > 14
                      ? '제안 만료'
                      : d.status === 'counter'
                        ? '역제안 수락 · 계약 체결'
                        : '최종 서명'}
                    <Check size={16} />
                  </button>
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
