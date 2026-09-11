'use client';
import { useInboxWorkspace } from './use-inbox-workspace';
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, MailCheck, Search } from 'lucide-react';
import type { useInboxReadQueue } from './use-inbox-read-queue';
import type { GameState, Player, Result } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { dateLabel } from '@dugout/shared/calendar';
import { InboxReport } from './inbox-report';
import { newsKinds, newsMeta, newsNeedsAction } from './inbox-model';

type Props = {
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onNegotiate: (p: Player) => void;
  initialReportId?: string;
  onReplay?: (r: Result) => void;
  reads: ReturnType<typeof useInboxReadQueue>;
};
export function InboxPanel({
  g,
  act,
  busy,
  onPlayer,
  onNegotiate,
  initialReportId,
  onReplay,
  reads,
}: Props) {
  const {
    displayGame,
    selectedId,
    filter,
    category,
    search,
    detailOpen,
    unread,
    decisions,
    items,
    selected,
    nextUnread,
    select,
    setFilter,
    setCategory,
    setSearch,
    setDetailOpen,
    order,
    setOrder,
    toolbarRef,
    index,
    previous,
    next,
  } = useInboxWorkspace(g, reads, initialReportId);
  return (
    <section className={`fm-inbox ${detailOpen ? 'show-letter' : ''}`}>
      <header className="inbox-topbar">
        <div>
          <Inbox size={22} />
          <h2>감독 수신함</h2>
          <span>{unread.length}건 안 읽음</span>
        </div>
        <button
          className="text-button"
          disabled={!unread.length}
          onClick={() => reads.markRead(unread.map((n) => n.id))}
        >
          <MailCheck size={15} /> 모두 읽음
        </button>
      </header>
      <div className="inbox-columns">
        <aside className="inbox-folder-rail" aria-label="보고 분류">
          {' '}
          <div className="inbox-navigation">
            <div className="inbox-filters" role="group" aria-label="수신함 보기">
              {[
                ['all', '전체 소식', g.news.length],
                ['unread', '안 읽음', unread.length],
                ['decision', '처리 필요', decisions.length],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(String(value))}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="inbox-categories" role="group" aria-label="보고 종류">
            <button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
              모든 주제
            </button>
            {Object.entries(newsKinds)
              .filter(([kind]) => g.news.some((n) => n.kind === kind))
              .map(([kind, meta]) => (
                <button
                  key={kind}
                  aria-pressed={category === kind}
                  onClick={() => setCategory(kind)}
                >
                  {meta.label}
                </button>
              ))}
          </div>
        </aside>
        <div className="inbox-message-list" aria-label="수신 보고 목록">
          <label className="inbox-sort">
            보고 순서
            <select
              aria-label="보고 순서"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </label>{' '}
          <label className="inbox-search">
            <Search size={16} />
            <input
              aria-label="수신함 검색"
              placeholder="보낸 사람 · 선수 · 내용 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {items.length ? (
            items.map((n, index) => {
              const meta = newsMeta(n),
                day = n.date || dateLabel(g, n.day),
                previous = items[index - 1];
              return (
                <div key={n.id}>
                  {(index === 0 || day !== (previous.date || dateLabel(g, previous.day))) && (
                    <div className="inbox-date-group">{day}</div>
                  )}
                  <button
                    className={`inbox-message ${n.read ? '' : 'unread'} ${selectedId === n.id ? 'selected' : ''}`}
                    aria-pressed={selectedId === n.id}
                    onClick={() => select(n.id)}
                  >
                    <div>
                      <span>{meta.name || meta.sender}</span>
                      {!n.read && <i aria-label="안 읽음" />}
                      {newsNeedsAction(n, displayGame) && <b>확인 필요</b>}
                    </div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <small>{meta.label}</small>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <Inbox size={30} />
              <p>조건에 맞는 보고가 없습니다.</p>
              <button
                className="text-button"
                onClick={() => {
                  setFilter('all');
                  setCategory('all');
                  setSearch('');
                }}
              >
                전체 보고 보기
              </button>
            </div>
          )}
        </div>
        <div className="inbox-reading-pane">
          <div className="inbox-letter-toolbar" ref={toolbarRef}>
            <button className="text-button inbox-back" onClick={() => setDetailOpen(false)}>
              <ArrowLeft size={16} /> 목록
            </button>
            <span className="inbox-reading-position">
              {index >= 0 ? `${index + 1} / ${items.length}` : '보고 열람'} · 과거 → 최신
            </span>
            <div className="inbox-letter-navigation">
              <button
                className="text-button"
                disabled={!previous}
                onClick={() => previous && select(previous.id)}
              >
                <ChevronLeft size={15} /> 이전
              </button>
              <button
                className="text-button"
                disabled={!next}
                onClick={() => next && select(next.id)}
              >
                다음 <ChevronRight size={15} />
              </button>
              <button
                className="text-button"
                disabled={!nextUnread}
                onClick={() => nextUnread && select(nextUnread.id)}
              >
                다음 안 읽은 메일 <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {selected ? (
            <InboxReport
              news={selected}
              g={displayGame}
              {...{ act, busy, onPlayer, onNegotiate, onReplay }}
            />
          ) : (
            <div className="empty-state">읽을 보고를 선택해 주세요.</div>
          )}
        </div>
      </div>
    </section>
  );
}
