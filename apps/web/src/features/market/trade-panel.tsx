'use client';
import Link from 'next/link';
import { useTradeDraft } from './use-trade-draft';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { ratingText } from '@dugout/shared/ratings';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { Choice } from '../../components/game-ui';
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
  const { getClub, rosterFor } = useWorld();
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
        {!g.trades?.length && <p>아직 제안한 트레이드가 없습니다.</p>}
        {g.trades?.map((o) => (
          <article className="manager-offer" key={o.id}>
            <h3>
              {getClub(o.club).name} ·{' '}
              {
                {
                  pending: '검토 중',
                  accepted: '구단 수락',
                  counter: '역제안',
                  rejected: '거절',
                  completed: '완료',
                  withdrawn: '철회',
                  expired: '만료',
                }[o.status]
              }
            </h3>
            <p>{o.message}</p>
            <p>
              답변 {o.due} · 만료 {o.expires} · 현금 {money(o.counterCash ?? o.cash)}
            </p>
            <p>
              보낼 선수:{' '}
              {o.outgoing
                .map(
                  (id) =>
                    g.roster.find((p) => p.id === id)?.name ||
                    rosterFor(g, o.club).find((p) => p.id === id)?.name ||
                    id,
                )
                .join(', ')}
              <br />
              받을 선수:{' '}
              {o.incoming
                .map(
                  (id) =>
                    g.roster.find((p) => p.id === id)?.name ||
                    rosterFor(g, o.club).find((p) => p.id === id)?.name ||
                    id,
                )
                .join(', ')}
            </p>
            {['accepted', 'counter'].includes(o.status) && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void act({ type: 'acceptTrade', id: o.id })}
              >
                위 조건으로 교환 확정
              </button>
            )}
            {['pending', 'accepted', 'counter'].includes(o.status) && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void act({ type: 'withdrawTrade', id: o.id })}
              >
                철회
              </button>
            )}
          </article>
        ))}
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
