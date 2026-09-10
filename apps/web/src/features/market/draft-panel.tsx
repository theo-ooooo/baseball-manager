'use client';
import type { GameState } from '@dugout/shared/types';
import { ratingText } from '@dugout/shared/ratings';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
export function DraftPanel({ g, act, busy }: { g: GameState; act: Act; busy: boolean }) {
  const { getClub } = useWorld(),
    d = g.draft,
    league = getClub(g.club).league,
    scout = g.staff.find((c) => c.role === '스카우트');
  const rule = ['kbo', 'cpbl'].includes(league)
    ? '시작 시점 순위 역순 · 3라운드'
    : ['mlb', 'npb'].includes(league)
      ? '추첨 순번 · 3라운드'
      : '아카데미 후보 중 최대 3명 영입';
  return (
    <div className="manager-office">
      <section className="panel panel-content">
        <h2>{d?.mode === 'academy' ? '아카데미 입단 심사' : '신인 선발'}</h2>
        <p>{rule}. 모든 선수는 가상 신인이며 3년 계약으로 입단합니다.</p>
        <p className="muted">
          리그별 게임용 간소화 규칙입니다. 실제 지명 자격·보상 지명·계약금 한도·NPB 중복 지명 추첨을
          재현하지 않습니다. 선발을 시작하면 순번이 고정됩니다.
        </p>
        {!d && (
          <button
            className="button primary"
            disabled={busy || !['preseason', 'finished'].includes(g.phase)}
            onClick={() => void act({ type: 'startDraft' })}
          >
            올해 신인 선발 시작
          </button>
        )}
        {d?.status === 'open' && (
          <>
            <p>
              현재 {Math.floor(d.cursor / d.order.length) + 1}라운드 · {getClub(g.club).name} 지명
              차례
            </p>
            <p>다음 날짜로 진행하며 7일간 관찰하면 능력 범위 보고를 받을 수 있습니다.</p>
            <div className="manager-form">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void act({ type: 'draftPass' })}
              >
                이번 지명 포기
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void act({ type: 'draftDelegate' })}
              >
                남은 지명 코치에게 위임
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>선수</th>
                    <th>포지션</th>
                    <th>나이</th>
                    <th>관찰</th>
                    <th>결정</th>
                  </tr>
                </thead>
                <tbody>
                  {d.prospects.map((p) => {
                    const assignment = g.scouting?.assignments.find(
                      (a) =>
                        a.status === 'active' &&
                        'playerId' in a.target &&
                        a.target.playerId === p.id,
                    );
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.pos}</td>
                        <td>{p.age}</td>
                        <td>
                          {ratingText(p)} {assignment && `· ${assignment.due} 보고`}
                        </td>
                        <td>
                          <button
                            className="button secondary compact"
                            disabled={busy || !scout || !!assignment}
                            onClick={() =>
                              void act({
                                type: 'assignScout',
                                playerId: p.id,
                                scoutId: scout?.id,
                                days: 7,
                              })
                            }
                          >
                            7일 관찰
                          </button>{' '}
                          <button
                            className="button primary compact"
                            disabled={busy}
                            onClick={() => void act({ type: 'draftPick', id: p.id })}
                          >
                            지명
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {d && (
        <section className="panel panel-content">
          <h2>지명 결과 · {d.status === 'finished' ? '완료' : '진행 중'}</h2>
          {d.picks.map((p, i) => (
            <p key={`${p.club}-${i}`}>
              {p.round}라운드 · {getClub(p.club).short} · {p.name}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
