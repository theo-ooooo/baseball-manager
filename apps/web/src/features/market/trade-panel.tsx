'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TradeRecommendationsPicker } from './trade-recommendations-picker';
import { tradeWindow } from '@dugout/shared/trade-window';
import { playerClubStanding } from '@dugout/shared/trade-policy';
import Link from 'next/link';
import { useTradeDraft } from './use-trade-draft';
import type { GameState, Player } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { ratingText } from '@dugout/shared/ratings';
import { playerPosition } from '@dugout/shared/management';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { Choice, Badge } from '../../components/game-ui';
import { TradeOfferCard } from './trade-offer-card';
import { DeadlineMarketPanel } from './deadline-market-panel';
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
  const { getClub } = useWorld();
  const d = useTradeDraft(g, targetId, act, busy);
  const window = tradeWindow(g, getClub(g.club).league);
  const locked =
    busy ||
    !!g.liveMatch ||
    window.closed ||
    !!g.managerCareer?.vacationUntil ||
    g.managerCareer?.status === 'unemployed';
  const list = (
    players: Player[],
    selected: string[],
    set: (ids: string[]) => void,
    query: string,
  ) => (
    <div className="trade-player-list">
      {players
        .filter((p) => `${p.name} ${playerPosition(p).label}`.includes(query.trim()))
        .map((p) => (
          <label key={p.id} className={selected.includes(p.id) ? 'selected' : ''}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              disabled={
                locked || d.reserved.has(p.id) || (!selected.includes(p.id) && selected.length >= 3)
              }
              onChange={(e) =>
                set(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            />
            <span>
              <strong>{p.name}</strong>
              <small className="trade-player-standing">
                {playerClubStanding(p, players).label}
              </small>
              <small>
                {playerPosition(p).label} · {p.age}세
              </small>
              <small>
                {d.reserved.has(p.id)
                  ? '다른 협상에 포함됨'
                  : `연봉 ${money(p.salary)} · ${p.years}년`}
              </small>
            </span>
            <b title="게임 내 종합 능력">{ratingText(p)}</b>
          </label>
        ))}
    </div>
  );
  return (
    <div className="trade-center">
      <header className="trade-center-header">
        <div>
          <small>구단 간 선수 교환</small>
          <h2>트레이드 센터</h2>
          <p>필요한 선수를 찾고, 두 구단이 수락할 조건을 만들어 보세요.</p>
        </div>
        <Link className="text-button" href="/?view=market">
          선수 시장으로 →
        </Link>
      </header>
      <p className="trade-window-note">
        <strong>{window.label}</strong>
        <span>
          현금으로 대체할 수 있는 전력 가치는 최대 30%입니다. 프랜차이즈 핵심 선수는 상대 구단이
          보호합니다.
        </span>
      </p>
      <DeadlineMarketPanel g={g} act={act} busy={busy} />
      <nav className="trade-tabs" aria-label="트레이드 업무">
        {[
          ['active', '진행 중', d.active.length],
          ['compose', '새 제안', null],
          ['history', '지난 협상', d.past.length],
        ].map(([key, label, count]) => (
          <button
            key={key}
            aria-pressed={key !== 'compose' && d.tab === key}
            onClick={() => (key === 'compose' ? d.startNew() : d.setTab(String(key)))}
          >
            {label}
            {count !== null && <b>{count}</b>}
          </button>
        ))}
      </nav>
      {g.liveMatch && (
        <p className="trade-guidance">경기 종료 후 제안을 보내거나 교환을 확정할 수 있습니다.</p>
      )}
      <div className="trade-advice-toolbar">
        <TradeRecommendationsPicker g={g} onSelect={d.applySuggestion} disabled={locked} />
        <p>받을 선수와 보낼 선수를 함께 추천합니다.</p>
      </div>
      <>
        <div className="trade-offer-list">
          {(d.tab === 'active' ? d.active : d.past).map((offer) => (
            <TradeOfferCard key={offer.id} {...{ g, offer, act, busy }} onRevise={d.revise} />
          ))}
          {!(d.tab === 'active' ? d.active : d.past).length && (
            <section className="trade-empty">
              <h3>
                {d.tab === 'active' ? '진행 중인 협상이 없습니다' : '아직 지난 협상이 없습니다'}
              </h3>
              <p>두 구단에서 각각 최대 3명의 선수와 현금을 교환할 수 있습니다.</p>
              <button className="button primary" onClick={d.startNew}>
                새 트레이드 제안하기
              </button>
            </section>
          )}
        </div>
      </>
      <Dialog open={d.open} onOpenChange={d.setOpen}>
        <DialogContent className="trade-composer-dialog">
          <DialogHeader>
            <DialogTitle>{d.offer ? '조건 수정해서 다시 제안' : '새 트레이드 제안'}</DialogTitle>
            <DialogDescription>
              {d.offer
                ? '같은 협상에서 선수와 현금 조건을 바꿉니다. 기존 답변을 확인한 뒤 다시 제안하세요.'
                : '받을 선수와 보낼 선수를 선택하고 조건을 검토하세요.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="trade-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void d.submit();
            }}
          >
            <header>
              <h3>어느 구단과 이야기할까요?</h3>
              {d.offer ? (
                <strong>
                  {getClub(d.club).name} · {(d.offer.round ?? d.offer.deadline?.round ?? 1) + 1}차
                  제안
                </strong>
              ) : (
                <Choice
                  label="협상 구단"
                  value={d.club}
                  onChange={(v) => {
                    d.setClub(v);
                    d.setIncoming([]);
                    d.setOtherQuery('');
                  }}
                  items={d.others.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            </header>
            <TradeRecommendationsPicker
              g={g}
              club={d.club}
              incoming={d.incoming}
              offerId={d.offer?.id}
              onSelect={d.applySuggestion}
              disabled={locked}
              label={
                d.incoming.length ? '이 선수를 받을 교환 대가 추천' : '이 구단과 교환할 선수 추천'
              }
            />
            <div className="trade-columns">
              {[
                {
                  side: 'outgoing',
                  title: '우리가 보낼 선수',
                  club: g.club,
                  players: g.roster,
                  selected: d.outgoing,
                  set: d.setOutgoing,
                  query: d.ownQuery,
                  setQuery: d.setOwnQuery,
                },
                {
                  side: 'incoming',
                  title: '우리가 받을 선수',
                  club: d.club,
                  players: d.otherRoster,
                  selected: d.incoming,
                  set: d.setIncoming,
                  query: d.otherQuery,
                  setQuery: d.setOtherQuery,
                },
              ].map((s) => (
                <section className="trade-selection" key={s.side}>
                  <header>
                    <Badge club={getClub(s.club)} size="small" />
                    <div>
                      <small>{getClub(s.club)?.name}</small>
                      <h3>{s.title}</h3>
                    </div>
                    <b>{s.selected.length}/3</b>
                  </header>
                  <input
                    className="trade-search"
                    aria-label={`${s.title} 검색`}
                    placeholder="선수 이름 · 포지션 검색"
                    value={s.query}
                    onChange={(e) => s.setQuery(e.target.value)}
                  />
                  {d.offer?.deadline && s.side === 'incoming' ? (
                    <p>{d.selectedIncoming.map((p) => p.name).join(' · ')} · 마감 경쟁 대상 고정</p>
                  ) : (
                    list(s.players, s.selected, s.set, s.query)
                  )}
                </section>
              ))}
            </div>
            <section className="trade-summary">
              <h3>제안 조건 확인</h3>
              <div className="trade-summary-players">
                <div>
                  <small>보낼 선수</small>
                  <strong>
                    {d.selectedOutgoing.map((p) => p.name).join(', ') || '선수를 선택하세요'}
                  </strong>
                </div>
                <span aria-hidden="true">⇄</span>
                <div>
                  <small>받을 선수</small>
                  <strong>
                    {d.selectedIncoming.map((p) => p.name).join(', ') || '선수를 선택하세요'}
                  </strong>
                </div>
              </div>
              <div className="trade-cash">
                <label>
                  현금 방향
                  <select value={d.direction} onChange={(e) => d.setDirection(e.target.value)}>
                    <option value="pay">우리 구단이 지급</option>
                    <option value="receive">우리 구단이 수령</option>
                  </select>
                </label>
                <label>
                  현금 (만 원)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={d.cash}
                    onChange={(e) => d.setCash(e.target.value)}
                  />
                </label>
                <div>
                  <small>{d.direction === 'pay' ? '추가 지급' : '수령 요청'}</small>
                  <strong>{money(Math.abs(d.amount) || 0)}</strong>
                  <small>현재 예산 {money(g.budget)}</small>
                </div>
              </div>
              <footer>
                <p>
                  상대 구단의 답변 후 직접 최종 확정합니다. 선수의 기존 연봉과 계약 기간은 새
                  구단으로 이어집니다.
                </p>
                <button
                  className="button primary"
                  disabled={
                    locked ||
                    d.invalid ||
                    !d.incoming.length ||
                    !d.outgoing.length ||
                    !Number.isFinite(d.amount) ||
                    Number(d.cash) < 0
                  }
                >
                  {d.offer ? '수정 조건으로 다시 제안' : '이 조건으로 제안 보내기'}
                </button>
              </footer>
            </section>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
