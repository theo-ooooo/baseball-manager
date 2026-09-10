import type { GameState } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import { money } from '@dugout/shared/game-view';
import { daysBetween, gameDate } from '@dugout/shared/calendar';
import {
  isActiveTrade,
  tradeNeedsConfirmation,
  tradeStatus,
  tradeStatusLabels,
} from '@dugout/shared/trade-status';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';

export function TradeOfferCard({
  g,
  offer,
  act,
  busy,
}: {
  g: GameState;
  offer: TradeOffer;
  act: Act;
  busy: boolean;
}) {
  const { getClub, rosterFor } = useWorld();
  const status = tradeStatus(g, offer);
  const active = isActiveTrade(g, offer);
  const ready = tradeNeedsConfirmation(g, offer);
  const remaining = daysBetween(gameDate(g), offer.expires);
  const cash = offer.status === 'counter' ? (offer.counterCash ?? offer.cash) : offer.cash;
  const otherRoster = rosterFor(g, offer.club);
  const names = (ids: string[]) =>
    ids
      .map(
        (id) =>
          g.roster.find((p) => p.id === id)?.name ||
          otherRoster.find((p) => p.id === id)?.name ||
          id,
      )
      .join(', ');
  return (
    <article className="manager-offer trade-offer-card">
      <h3>
        {getClub(offer.club).name} · {tradeStatusLabels[status]}
      </h3>
      {active && (
        <strong className="trade-deadline">
          {remaining === 0 ? '오늘 마감' : `마감까지 ${remaining}일`} · {offer.expires}
        </strong>
      )}
      <p>{offer.message}</p>
      <p>
        제안 {offer.date} · 답변 예정 {offer.due}
      </p>
      <p>
        현금 조건: {cash >= 0 ? '우리 구단 지급' : '우리 구단 수령'} {money(Math.abs(cash))}
      </p>
      <p>
        보낼 선수: {names(offer.outgoing)}
        <br />
        받을 선수: {names(offer.incoming)}
      </p>
      <div className="trade-offer-actions">
        {ready && (
          <button
            className="button primary"
            disabled={busy || !!g.liveMatch}
            onClick={() => void act({ type: 'acceptTrade', id: offer.id })}
          >
            위 조건으로 교환 확정
          </button>
        )}
        {active && (
          <button
            className="text-button"
            disabled={busy || !!g.liveMatch}
            onClick={() => void act({ type: 'withdrawTrade', id: offer.id })}
          >
            제안 철회
          </button>
        )}
      </div>
    </article>
  );
}
