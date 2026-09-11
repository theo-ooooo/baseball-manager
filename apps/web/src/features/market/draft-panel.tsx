'use client';
import Link from 'next/link';
import type { GameState } from '@dugout/shared/types';
import { ratingText, potentialText } from '@dugout/shared/ratings';
import { playerPosition } from '@dugout/shared/management';
import { money } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
import { useRookieDraft } from './use-rookie-draft';
export function DraftPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { getClub } = useWorld(),
    d = g.draft,
    h = useRookieDraft(g),
    rounds = d?.rounds || h.window.rounds;
  const scout = g.staff.find((c) => c.role === '스카우트');
  const round = d ? Math.min(d.rounds || 3, Math.floor(d.cursor / d.order.length) + 1) : 1;
  return (
    <div className="rookie-draft-center">
      <header className="draft-hero">
        <small>
          {g.year} · {getClub(g.club).name}
        </small>
        <h2>{d?.mode === 'academy' ? '아카데미 입단 심사' : '신인 드래프트'}</h2>
        <p>미래의 주전을 직접 선택하세요. 지명 선수는 3년 계약으로 2군에 합류합니다.</p>
        <p className="draft-period">
          <strong>드래프트 기간 {h.window.label}</strong>
          <small>
            {h.window.basis}
            {d?.orderYear ? ` · ${d.orderYear}시즌 최종 순위 기준` : ''}
          </small>
        </p>
        <details>
          <summary>드래프트 진행 방식</summary>
          <p>
            {d?.orderSource || '직전 시즌 최종 순위 역순'} · {rounds}라운드. 모든 후보는 가상
            신인입니다. 실제 리그의 지명 자격·보상 지명·중복 지명 규정은 간소화되어 있습니다.
          </p>
        </details>
        {!d && (
          <>
            <button
              className="button primary"
              disabled={busy || !h.canStart}
              onClick={() => void act({ type: 'startDraft' })}
            >
              올해 드래프트 입장
            </button>
            {!h.canStart && <p>안내된 드래프트 기간에 입장할 수 있습니다.</p>}
          </>
        )}
      </header>
      {d?.status === 'open' && (
        <>
          <section className="draft-turn">
            <div>
              <small>우리 구단 지명 차례</small>
              <h3>
                {round}라운드 · 전체 {d.cursor + 1}순위
              </h3>
            </div>
            <div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void act({ type: 'draftDelegate' })}
              >
                남은 지명 코치에게 맡기기
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void act({ type: 'draftPass' })}
              >
                이번 순번 포기
              </button>
            </div>
          </section>
          <section className="draft-candidates">
            <header>
              <h3>남은 후보 {d.prospects.length}명</h3>
              <input
                type="search"
                aria-label="신인 이름 검색"
                placeholder="이름으로 찾기"
                value={h.query}
                onChange={(e) => h.setQuery(e.target.value)}
              />
              <select
                aria-label="신인 포지션"
                value={h.position}
                onChange={(e) => h.setPosition(e.target.value)}
              >
                {[
                  ['all', '모든 포지션'],
                  ['P', '투수'],
                  ['C', '포수'],
                  ['IF', '내야수'],
                  ['OF', '외야수'],
                  ['DH', '지명타자'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </header>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      '선수',
                      '포지션',
                      '나이',
                      '오버롤',
                      ...(g.rules?.revealPotential ? ['잠재력'] : []),
                      '선택',
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {h.players.map((p) => (
                    <tr key={p.id} className={h.selected === p.id ? 'selected' : ''}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{playerPosition(p).label}</td>
                      <td>{p.age}세</td>
                      <td>{ratingText(p)}</td>
                      {g.rules?.revealPotential && <td>{potentialText(p)}</td>}
                      <td>
                        <button
                          className="button secondary compact"
                          onClick={() => h.setSelected(p.id)}
                        >
                          검토
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {h.candidate && (
            <section className="draft-selection-review">
              <small>지명 후보 검토</small>
              <h3>
                {h.candidate.name} · {playerPosition(h.candidate).label}
              </h3>
              <p>
                {h.candidate.age}세 · 오버롤 {ratingText(h.candidate)} · 연봉{' '}
                {money(h.candidate.salary)} · 3년 계약
              </p>
              <p>지명하면 즉시 우리 구단 2군에 합류하고 다음 구단의 지명이 진행됩니다.</p>
              <div>
                <button
                  className="button primary"
                  disabled={busy || g.roster.length >= 85}
                  onClick={async () => {
                    if (await act({ type: 'draftPick', id: h.candidate!.id })) h.setSelected('');
                  }}
                >
                  이 선수를 {round}라운드에 지명
                </button>
                <button
                  className="button secondary"
                  disabled={
                    busy ||
                    !scout ||
                    g.scouting?.assignments.some(
                      (a) =>
                        a.status === 'active' &&
                        'playerId' in a.target &&
                        a.target.playerId === h.candidate?.id,
                    )
                  }
                  onClick={() =>
                    void act({
                      type: 'assignScout',
                      playerId: h.candidate!.id,
                      scoutId: scout?.id,
                      days: 7,
                    })
                  }
                >
                  7일 관찰 의뢰
                </button>
              </div>
              {g.roster.length >= 85 && (
                <p>선수단 정원이 가득 찼습니다. 자리를 확보하거나 이번 순번을 포기해 주세요.</p>
              )}
            </section>
          )}
        </>
      )}
      {d && (
        <section className="draft-results">
          <header>
            <h3>지명 보드</h3>
            <span>
              {d.status === 'finished' ? '모든 지명 완료' : `${round}/${rounds}라운드 진행 중`}
            </span>
          </header>
          {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
            <div key={r}>
              <h4>{r}라운드</h4>
              {d.picks
                .filter((p) => p.round === r)
                .map((p, i) => (
                  <p key={`${p.club}-${i}`}>
                    <span>{getClub(p.club).short}</span>
                    {p.playerId ? (
                      <Link href={`/players/${encodeURIComponent(p.playerId)}`}>{p.name}</Link>
                    ) : (
                      <small>지명 포기</small>
                    )}
                  </p>
                ))}
            </div>
          ))}
          {d.status === 'finished' && (
            <Link className="button primary" href="/?view=reserves">
              입단 선수 · 2군 확인 →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
