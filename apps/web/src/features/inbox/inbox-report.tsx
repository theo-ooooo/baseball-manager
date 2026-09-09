import Link from 'next/link';
import { ArrowUpRight, FileSignature, UserRound } from 'lucide-react';
import type { GameState, NewsItem, Player, Result } from '@dugout/shared/types';
import { money } from '@dugout/shared/game-view';
import { dateLabel } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
import { contractReview, newsMeta, newsNeedsAction } from './inbox-model';
import { useWorld } from '../career/world-context';

export function InboxReport({
  news,
  g,
  act,
  busy,
  onPlayer,
  onNegotiate,
  onReplay,
}: {
  news: NewsItem;
  g: GameState;
  act: Act;
  busy: boolean;
  onPlayer: (p: Player) => void;
  onNegotiate: (p: Player) => void;
  onReplay?: (r: Result) => void;
}) {
  const { marketPlayers, getClub } = useWorld();
  const match = news.matchId ? g.history.find((r) => r.id === news.matchId) : undefined;
  const scouting = news.actionView === 'scouting';
  const candidates =
    scouting && news.report?.players?.length
      ? new Map(marketPlayers(g).map((p) => [p.id, p]))
      : undefined;
  const meta = newsMeta(news),
    review = contractReview(news);
  const players =
    news.report?.players ||
    (review
      ? g.roster
          .filter((p) => p.years === 1)
          .map((p) => ({
            id: p.id,
            name: p.name,
            salary: p.salary,
            years: p.years,
            detail: `${p.age}세 · ${p.pos} · 현재 소속 선수 기준`,
          }))
      : []);
  const player = g.roster.find((p) => p.id === news.playerId);
  const deal = g.deals.find(
    (d) => d.id === news.dealId || (!news.dealId && d.player.id === news.playerId),
  );
  const subject = player || deal?.player;
  return (
    <article className="inbox-report">
      <header className="inbox-report-header">
        <div className="inbox-report-labels">
          <span>{meta.label}</span>
          {newsNeedsAction(news, g) && <b>감독 확인 필요</b>}
        </div>
        <h2>{news.title}</h2>
        <div className="inbox-sender">
          <span className="inbox-sender-avatar">
            <UserRound size={20} />
          </span>
          <div>
            <strong>{meta.name || meta.sender}</strong>
            <small>
              {meta.role} → {g.manager} 감독
            </small>
          </div>
          <time>{news.date || dateLabel(g, news.day)}</time>
        </div>
      </header>
      <div className="inbox-report-content">
        {match && (
          <section className="inbox-match-result" aria-label="경기 최종 결과">
            <div>
              <span>
                {getClub(match.away).name}
                <small>원정</small>
              </span>
              <strong>
                {match.awayScore} : {match.homeScore}
              </strong>
              <span>
                {getClub(match.home).name}
                <small>홈</small>
              </span>
            </div>
            {onReplay && (
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={() => onReplay(match)}
              >
                경기 기록 · 다시보기 <ArrowUpRight size={14} />
              </button>
            )}
          </section>
        )}
        <p className="inbox-letter-greeting">{g.manager} 감독님께,</p>
        <div className="inbox-letter-body">
          {news.body.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {!!news.report?.facts?.length && (
          <dl className="inbox-facts">
            {news.report.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {news.report?.sections?.map((section) => (
          <section className="inbox-report-section" key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </section>
        ))}
        {players.length > 0 && (
          <section className="inbox-report-section">
            <h3>
              {review ? '계약 검토 대상' : '점검할 선수'} <span>{players.length}명</span>
            </h3>
            <div className="inbox-player-list">
              {players.map((row) => {
                const current = g.roster.find((p) => p.id === row.id),
                  candidate = candidates?.get(row.id),
                  subject = current || candidate,
                  pending = g.deals.find(
                    (d) =>
                      d.player.id === row.id &&
                      !['withdrawn', 'expired', 'rejected'].includes(d.status),
                  );
                return (
                  <div className="inbox-player-row" key={row.id}>
                    <div>
                      <button
                        className="text-button"
                        disabled={!subject}
                        onClick={() => subject && onPlayer(subject)}
                      >
                        {row.name}
                      </button>
                      <small>{row.detail}</small>
                      {row.salary !== undefined && (
                        <small>
                          보고 당시 연봉 {money(row.salary)} · 잔여 {row.years}년
                        </small>
                      )}
                    </div>
                    <div className="inbox-player-action">
                      {scouting &&
                        (current ? (
                          <small>구단 합류 완료</small>
                        ) : candidate ? (
                          <button
                            className="button secondary compact"
                            disabled={busy}
                            onClick={() => onNegotiate(candidate)}
                          >
                            계약 제안
                          </button>
                        ) : (
                          <small>영입 대상 소속 변경</small>
                        ))}
                      {review &&
                        (current ? (
                          current.years > 1 && !pending ? (
                            <span className="inbox-resolved">재계약 완료 · {current.years}년</span>
                          ) : (
                            <>
                              <small>
                                {pending
                                  ? pending.status === 'pending'
                                    ? '상대 답변 대기'
                                    : pending.status === 'accepted'
                                      ? '조건 합의 · 서명 대기'
                                      : '역제안 도착'
                                  : '이번 시즌 만료'}
                              </small>
                              <button
                                className="button secondary compact"
                                disabled={busy}
                                onClick={() => onNegotiate(current)}
                              >
                                <FileSignature size={14} />
                                {pending ? '협상 이어가기' : '재계약 협상'}
                              </button>
                            </>
                          )
                        ) : (
                          <small>현재 소속 선수 아님</small>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <div className="inbox-report-actions">
          {news.actionView === 'agents' && subject && (
            <button className="button primary" disabled={busy} onClick={() => onNegotiate(subject)}>
              <FileSignature size={16} />
              {deal?.status === 'accepted' ? '계약서 검토 · 서명' : '협상실로 이동'}
            </button>
          )}
          {news.actionView && !(news.actionView === 'agents' && subject) && (
            <Link className="button secondary" href={`/?view=${news.actionView}`}>
              {news.actionView === 'agents'
                ? '전체 계약 협상'
                : news.actionView === 'media'
                  ? '인터뷰 · 라커룸으로'
                  : news.actionView === 'staff'
                    ? '코치 협상 확인'
                    : news.actionView === 'scouting'
                      ? '관찰 보고 · 선수 비교'
                      : news.actionView === 'market'
                        ? '영입 대상 확인'
                        : '선수단 확인'}
              <ArrowUpRight size={15} />
            </Link>
          )}
          {player && !review && (
            <button className="button secondary" onClick={() => onPlayer(player)}>
              선수 상세 보기
            </button>
          )}
        </div>
        {news.choiceKind && !news.choice && (
          <section className="inbox-decision">
            <h3>감독님의 답변을 기다리고 있습니다</h3>
            <p>출전 기회를 약속하거나 현재 운용 방침을 설명해 주세요.</p>
            <div>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void act({ type: 'respondNews', id: news.id, choice: 'promise' })}
              >
                2주 내 출전 약속
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void act({ type: 'respondNews', id: news.id, choice: 'explain' })}
              >
                현재 운용 방침 설명
              </button>
            </div>
            <small>타자 4경기 / 투수 1경기 출전 약속 · 이행 여부가 선수 신뢰에 반영됩니다.</small>
          </section>
        )}
        {news.response && <p className="inbox-resolved">답변 완료 · {news.response}</p>}
        <footer className="inbox-letter-footer">
          {meta.name || meta.sender}
          <span>{meta.role}</span>
        </footer>
      </div>
    </article>
  );
}
