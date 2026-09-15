import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import { money } from '@dugout/shared/game-view';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import {
  isActiveTrade,
  tradeNeedsConfirmation,
  tradeCanRevise,
  tradeStatus,
  tradeStatusLabels,
} from '@dugout/shared/trade-status';
import { useWorld } from '../career/world-context';
import { Badge } from '../../components/game-ui';
import type { Act } from '../career/game-contracts';
export function TradeOfferCard({
  g,
  offer,
  act,
  busy,
  onRevise,
}: {
  g: GameState;
  offer: TradeOffer;
  act: Act;
  busy: boolean;
  onRevise: (offer: TradeOffer) => void;
}) {
  const { getClub, rosterFor } = useWorld();
  const status = tradeStatus(g, offer),
    active = isActiveTrade(g, offer),
    ready = tradeNeedsConfirmation(g, offer),
    remaining = daysBetween(gameDate(g), offer.expires);
  const cash = offer.status === 'counter' ? (offer.counterCash ?? offer.cash) : offer.cash;
  const pool = [...g.roster, ...rosterFor(g, offer.club), ...g.transferred];
  const names = (ids: string[]) =>
    ids.map((id) => (
      <Link key={id} href={`/players/${encodeURIComponent(id)}`}>
        {pool.find((p) => p.id === id)?.name || '소속이 바뀐 선수'}
      </Link>
    ));
  return (
    <article className={`trade-negotiation-card ${ready ? 'awaiting-confirmation' : ''}`}>
      <header>
        <Badge club={getClub(offer.club)} size="small" />
        <div>
          <h3>{getClub(offer.club).name}</h3>
          <small>
            {offer.date} · {offer.round ?? offer.deadline?.round ?? 1}차 제안
            {status === 'pending' ? ` · ${offer.due} 답변 예정` : ''}
          </small>
        </div>
        <span className="trade-status">{tradeStatusLabels[status]}</span>
      </header>
      {ready && (
        <p className="trade-ready-notice">
          상대 조건을 수락하거나, 선수·현금을 바꿔 다시 제안할 수 있습니다. 최종 확정할 때만 선수가
          이동합니다.
        </p>
      )}
      <p className="trade-club-reply">{offer.message}</p>
      <div className="trade-exchange">
        <div>
          <small>우리 구단이 보내는 선수</small>
          {names(status === 'counter' ? offer.counterOutgoing || offer.outgoing : offer.outgoing)}
        </div>
        <span aria-hidden="true">⇄</span>
        <div>
          <small>우리 구단이 받는 선수</small>
          {names(status === 'counter' ? offer.counterIncoming || offer.incoming : offer.incoming)}
        </div>
      </div>
      {status === 'counter' && offer.counterOutgoing && (
        <details className="trade-original-offer">
          <summary>이번 차수에서 내가 제안한 선수 구성</summary>
          <div>
            {names(offer.outgoing)}
            <span>⇄</span>
            {names(offer.incoming)}
          </div>
        </details>
      )}
      <dl className="trade-terms">
        <div>
          <dt>현금 {cash >= 0 ? '지급' : '수령'}</dt>
          <dd>{money(Math.abs(cash))}</dd>
        </div>
        {status === 'counter' && (
          <div>
            <dt>내 이전 현금 제안</dt>
            <dd>
              {offer.cash >= 0 ? '지급' : '수령'} {money(Math.abs(offer.cash))}
            </dd>
          </div>
        )}
        {active && (
          <div>
            <dt>답변 기한</dt>
            <dd>
              {remaining === 0 ? '오늘 마감' : `${remaining}일 남음`} · {offer.expires}
            </dd>
          </div>
        )}
      </dl>
      {!!offer.history?.length && (
        <details className="trade-round-history">
          <summary>이전 협상 {offer.history.length}건</summary>
          {offer.history.map((r) => (
            <div key={r.round}>
              <strong>
                {r.round}차 · {r.date} · {tradeStatusLabels[r.status]}
              </strong>
              <p>
                제안: {names(r.outgoing)} ⇄ {names(r.incoming)} · {r.cash >= 0 ? '지급' : '수령'}{' '}
                {money(Math.abs(r.cash))}
              </p>
              {r.status === 'counter' && (
                <p>
                  상대 역제안: {names(r.counterOutgoing || r.outgoing)} ⇄{' '}
                  {names(r.counterIncoming || r.incoming)} ·{' '}
                  {(r.counterCash ?? r.cash) >= 0 ? '지급' : '수령'}{' '}
                  {money(Math.abs(r.counterCash ?? r.cash))}
                </p>
              )}
              <p>{r.message}</p>
            </div>
          ))}
        </details>
      )}
      {(active || tradeCanRevise(g, offer)) && (
        <footer className="trade-offer-actions">
          {ready ? (
            <button
              className="button primary"
              disabled={busy || !!g.liveMatch || !!(offer.deadline && !offer.deadline.leading)}
              onClick={() => void act({ type: 'acceptTrade', id: offer.id })}
            >
              {offer.deadline && !offer.deadline.leading
                ? '경쟁 조건 보강 필요'
                : '이 조건으로 트레이드 확정'}
            </button>
          ) : (
            <span>
              {status === 'pending'
                ? '상대 구단의 답변을 기다리고 있습니다.'
                : '선수 구성을 바꿔 다시 제안할 수 있습니다.'}
            </span>
          )}
          {tradeCanRevise(g, offer) && (
            <button
              className="button secondary"
              disabled={busy || !!g.liveMatch}
              onClick={() => onRevise(offer)}
            >
              조건 수정해서 다시 제안
            </button>
          )}
          {active && (
            <button
              className="button secondary"
              disabled={busy || !!g.liveMatch}
              onClick={() => void act({ type: 'withdrawTrade', id: offer.id })}
            >
              제안 철회
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
