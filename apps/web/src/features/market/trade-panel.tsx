'use client';
import Link from 'next/link';
import { useTradeDraft } from './use-trade-draft';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { ratingText } from '@dugout/shared/ratings';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { Choice } from '../../components/game-ui';
import { isActiveTrade, tradeNeedsConfirmation } from '@dugout/shared/trade-status';
import { TradeOfferCard } from './trade-offer-card';
export function TradePanel({
  g,
  act,
  busy,
  targetId,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  targetId?: string;
}) {
  const { rosterFor } = useWorld();
  const activeTrades = (g.trades || [])
    .filter((offer) => isActiveTrade(g, offer))
    .sort(
      (a, b) =>
        Number(tradeNeedsConfirmation(g, b)) - Number(tradeNeedsConfirmation(g, a)) ||
        a.expires.localeCompare(b.expires),
    );
  const pastTrades = (g.trades || []).filter((offer) => !isActiveTrade(g, offer));
  const { others, club, setClub, outgoing, setOutgoing, incoming, setIncoming, cash, setCash } =
    useTradeDraft(g, targetId);
  const list = (players: Player[], selected: string[], set: (ids: string[]) => void) => (
    <div className="trade-player-list">
      {players.map((p) => (
        <label key={p.id}>
          <input
            type="checkbox"
            checked={selected.includes(p.id)}
            disabled={busy || (!selected.includes(p.id) && selected.length >= 3)}
            onChange={(e) =>
              set(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
            }
          />
          <span>
            {p.name} · {p.pos} · {p.age}세{' '}
            <small>
              평가 {ratingText(p)} · 연봉 {money(p.salary)} · {p.years}년
            </small>
          </span>
        </label>
      ))}
    </div>
  );
  return (
    <div className="manager-office">
      <section className="panel panel-content">
        <h2>협상 중인 트레이드</h2>
        {!activeTrades.length && (
          <p>진행 중인 협상이 없습니다. 아래에서 새 트레이드를 제안할 수 있습니다.</p>
        )}
        {g.liveMatch && <p>경기를 마친 뒤 트레이드를 확정하거나 철회할 수 있습니다.</p>}
        {activeTrades.map((offer) => (
          <TradeOfferCard key={offer.id} {...{ g, offer, act, busy }} />
        ))}
        {!!pastTrades.length && (
          <details className="trade-history">
            <summary>지난 협상 · {pastTrades.length}건</summary>
            {pastTrades.map((offer) => (
              <TradeOfferCard key={offer.id} {...{ g, offer, act, busy }} />
            ))}
          </details>
        )}
      </section>
      <section className="panel panel-content">
        <h2>구단 간 트레이드</h2>
        <p>
          같은 리그 구단끼리 최대 3명 대 3명과 현금을 교환합니다. 구단 답변 후 최종 확정하며 기존
          연봉·계약·성적을 승계합니다.
        </p>
        <Choice
          label="협상 구단"
          value={club}
          onChange={(v) => {
            setClub(v);
            setIncoming([]);
          }}
          items={others.map((c) => ({ value: c.id, label: c.name }))}
        />
        <div className="trade-columns">
          <section>
            <h3>보낼 선수 {outgoing.length}/3</h3>
            {list(g.roster, outgoing, setOutgoing)}
          </section>
          <section>
            <h3>받을 선수 {incoming.length}/3</h3>
            {list(rosterFor(g, club), incoming, setIncoming)}
          </section>
        </div>
        <div className="manager-form">
          <label>
            현금 (백만원){' '}
            <input type="number" step="1" value={cash} onChange={(e) => setCash(e.target.value)} />
            <small>양수: 지급 · 음수: 수령 요청</small>
          </label>
          <button
            className="button primary"
            disabled={busy || !incoming.length || !outgoing.length}
            onClick={async () => {
              if (
                await act({ type: 'proposeTrade', club, outgoing, incoming, cash: Number(cash) })
              ) {
                setOutgoing([]);
                setIncoming([]);
              }
            }}
          >
            트레이드 제안
          </button>
        </div>
      </section>
      <Link className="text-button" href="/?view=market">
        선수 시장으로
      </Link>
    </div>
  );
}
