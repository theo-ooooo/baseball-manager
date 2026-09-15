'use client';
import Link from 'next/link';
import { TradeRecommendationsPicker } from './trade-recommendations-picker';
import { Clock3, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import { deadlineLabels, deadlineOffer } from '@dugout/shared/deadline-market';
import { gameDate, addDays } from '@dugout/shared/calendar';
import { money } from '@dugout/shared/game-view';
import { ratingText } from '@dugout/shared/ratings';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
import { useDeadlineMarket } from './use-deadline-market';

export function DeadlineMarketPanel({
  g,
  act,
  busy,
  compact = false,
}: {
  g: GameState;
  act: Act;
  busy: boolean;
  compact?: boolean;
}) {
  const s = useDeadlineMarket(g, act, busy),
    { getClub } = useWorld();
  if (compact && !s.window.active && !s.listings.some((l) => l.status === 'open')) return null;
  if (!s.window.active && !s.listings.length) return null;
  return (
    <section className="deadline-market" aria-label="마감 직전 영입 경쟁">
      <header>
        <div>
          <span>
            <Clock3 size={15} />
            {s.window.closed ? '이번 시즌 마감' : '트레이드 마감'}{' '}
            {s.window.active
              ? s.window.remaining === 0
                ? 'D-DAY'
                : `D-${s.window.remaining}`
              : ''}
          </span>
          <h2>늦으면 다른 유니폼을 입습니다</h2>
          <p>{s.window.label} · 경쟁 구단의 실제 선수 교환 제안입니다.</p>
        </div>
        {compact && (
          <Link className="button secondary compact" href="/?view=trade">
            협상실로 <ArrowRight size={15} />
          </Link>
        )}
      </header>
      {compact ? (
        <div className="deadline-compact-list">
          {s.listings.map((l) => (
            <p key={l.id}>
              <strong>{l.player.name}</strong>
              <span>
                {l.status === 'open'
                  ? `${getClub(l.rival.club).name}와 영입 경쟁 · ${addDays(l.closes, -1)}까지 확정`
                  : deadlineLabels[l.status]}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <div className="deadline-listings">
          {s.listings.map((l) => {
            const o = deadlineOffer(g, l),
              active = l.status === 'open' && gameDate(g) < l.closes;
            return (
              <article key={l.id} id={`deadline-${l.player.id}`}>
                <span className={`deadline-listing-status ${l.status}`}>
                  {deadlineLabels[l.status]}
                </span>
                <h3>
                  <Link href={`/players/${encodeURIComponent(l.player.id)}`}>
                    {l.player.name} ↗
                  </Link>
                </h3>
                <p>
                  {getClub(l.seller).name} · {l.player.pos} · {l.player.age}세
                </p>
                <div className="deadline-rival">
                  <span>경쟁 구단 · {getClub(l.rival.club).name}</span>
                  <strong>
                    {l.rival.player.name} + {money(l.rival.cash)}
                  </strong>
                  <small>상대 구단이 공개한 교환 조건</small>
                </div>
                {active ? (
                  <>
                    <p className="deadline-time">
                      <b>{addDays(l.closes, -1)}까지 최종 확정</b>
                      <span>{l.closes}로 날짜를 넘기면 매각이 결정됩니다.</span>
                    </p>
                    {o && (
                      <div className={`deadline-response ${o.deadline?.leading ? 'leading' : ''}`}>
                        <strong>
                          {o.deadline?.round}차 제안 ·{' '}
                          {o.deadline?.leading ? '우리 조건 우세' : '조건 보강 필요'}
                        </strong>
                        <p>{o.message}</p>
                        <p>{o.deadline?.feedback}</p>
                      </div>
                    )}
                    {o && (
                      <div className="deadline-own-return">
                        <small>
                          {o.status === 'counter'
                            ? '상대가 원하는 우리 선수'
                            : '우리가 제안한 선수'}
                        </small>
                        <strong>
                          {(o.counterOutgoing || o.outgoing)
                            .map(
                              (id) => g.roster.find((p) => p.id === id)?.name || '소속 확인 필요',
                            )
                            .join(' · ')}
                        </strong>
                        <p>추가 현금 {money(o.counterCash ?? o.cash)}</p>
                      </div>
                    )}
                    <div className="deadline-buttons">
                      <button
                        className="button secondary"
                        disabled={s.locked}
                        onClick={() => s.show(l)}
                      >
                        {o ? '조건 바꿔 다시 제안' : '영입 조건 제안'}
                      </button>
                      {o?.deadline?.leading && (
                        <button
                          className="button primary"
                          disabled={s.locked}
                          onClick={() => void act({ type: 'acceptTrade', id: o.id })}
                        >
                          이 조건으로 영입 확정
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="deadline-result">{l.result || '매각 결정 보고를 기다립니다.'}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {!s.listings.length && (
        <p className="deadline-empty">
          현재 우리 리그에서 성사 가능한 경쟁 매물이 없습니다. 일반 트레이드 제안은 마감일까지 보낼
          수 있습니다.
        </p>
      )}
      <Dialog open={s.open} onOpenChange={s.setOpen}>
        <DialogContent className="deadline-bid-dialog">
          <DialogHeader>
            <DialogTitle>{s.listing?.player.name} 영입 조건</DialogTitle>
            <DialogDescription>
              보낼 선수 1~3명과 현금을 골라 제안하세요. 구단 답변을 확인한 뒤 별도로 최종
              확정합니다.
            </DialogDescription>
          </DialogHeader>
          {s.listing && (
            <p className="deadline-bid-rival">
              {getClub(s.listing.rival.club).name} 제안: {s.listing.rival.player.name} +{' '}
              {money(s.listing.rival.cash)}
            </p>
          )}
          {s.listing && (
            <TradeRecommendationsPicker
              g={g}
              club={s.listing.seller}
              incoming={[s.listing.player.id]}
              offerId={s.offer?.id}
              onSelect={s.applySuggestion}
              disabled={s.locked}
              label="이 선수를 받을 교환 대가 추천"
            />
          )}
          <label>
            우리 선수 검색
            <input
              aria-label="입찰에 포함할 선수 검색"
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
              placeholder="이름 · 포지션"
            />
          </label>
          <div className="deadline-bid-players" role="group" aria-label="보낼 선수 선택">
            {s.candidates.map((p) => (
              <label key={p.id} className={s.outgoing.includes(p.id) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={s.outgoing.includes(p.id)}
                  disabled={
                    s.locked ||
                    s.reserved.has(p.id) ||
                    (!s.outgoing.includes(p.id) && s.outgoing.length >= 3)
                  }
                  onChange={(e) =>
                    s.setOutgoing(
                      e.target.checked
                        ? [...s.outgoing, p.id]
                        : s.outgoing.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.pos} · {p.age}세 · OVR {ratingText(p)}
                    {s.reserved.has(p.id) ? ' · 다른 협상에 포함' : ''}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="deadline-bid-summary">
            <strong>보낼 선수 {s.outgoing.length}/3명</strong>
            <p>
              {s.outgoing.map((id) => g.roster.find((p) => p.id === id)?.name).join(' · ') ||
                '아직 선택하지 않았습니다.'}
            </p>
          </div>
          <label>
            추가 지급 현금 (만 원)
            <input
              type="number"
              min="0"
              step="1"
              aria-label="입찰 추가 현금"
              value={s.cash}
              onChange={(e) => s.setCash(e.target.value)}
            />
          </label>
          <p>
            제안 현금 {money(s.amount || 0)} · 우리 예산 {money(g.budget)}
            <br />
            현금은 선수 교환 가치의 30%까지만 평가합니다.
          </p>
          <button className="button primary" disabled={!s.ready} onClick={() => void s.submit()}>
            {s.offer ? '수정 조건으로 즉시 재협상' : '이 조건으로 즉시 협상'}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
