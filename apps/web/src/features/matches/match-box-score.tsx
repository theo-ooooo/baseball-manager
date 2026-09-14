'use client';
import { MatchManagerReview } from './match-manager-review';
import Link from 'next/link';
import type { Result } from '@dugout/shared/types';
import { matchBoxScore } from '@dugout/shared/match-box-score';
import { useMatchReport } from './use-match-report';
import { useWorld } from '../career/world-context';
export function MatchBoxScore({ match, club }: { match: Result; club: string }) {
  const { getClub } = useWorld(),
    report = useMatchReport(match, club);
  const { side, setSide } = report;
  if (!report.result)
    return (
      <section className="match-box-score" aria-live="polite">
        <p>{report.error || '선수별 경기 기록을 불러오고 있습니다…'}</p>
        {report.error && (
          <button className="button secondary" onClick={report.retry}>
            다시 불러오기
          </button>
        )}
      </section>
    );
  const rows = matchBoxScore(report.result),
    team = rows[side];
  return (
    <section className="match-box-score">
      <MatchManagerReview result={report.result} />
      <header>
        <div>
          <small>경기 기록</small>
          <h3>누가 어떻게 뛰었나요?</h3>
        </div>
        <nav aria-label="기록을 볼 구단">
          {rows.map((r, i) => (
            <button key={r.club} aria-pressed={i === side} onClick={() => setSide(i)}>
              {getClub(r.club)?.short || r.club}
            </button>
          ))}
        </nav>
      </header>
      <div className="box-score-totals">
        <span>
          득점 <b>{side ? match.homeScore : match.awayScore}</b>
        </span>
        <span>
          안타 <b>{match.hits[side]}</b>
        </span>
        <span>
          실책 <b>{match.errors[side]}</b>
        </span>
      </div>
      {!team.batters.length ? (
        <p>이 경기에는 선수별 플레이 기록이 보관되어 있지 않습니다.</p>
      ) : (
        <>
          <h4>타격 · {getClub(team.club)?.name}</h4>
          <div className="box-table-scroll" tabIndex={0} role="region" aria-label="타자 경기 기록">
            <table>
              <thead>
                <tr>
                  {['선수', '타수', '안타', '홈런', '타점', '볼넷', '삼진', '도루'].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.batters.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      <Link href={`/players/${encodeURIComponent(p.id)}`}>{p.name}</Link>
                    </th>
                    {[p.ab, p.h, p.hr, p.rbi, p.bb, p.k, p.sb].map((v, i) => (
                      <td key={i} className={i === 1 && v ? 'box-hit' : ''}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>합계</th>
                  {(['ab', 'h', 'hr', 'rbi', 'bb', 'k', 'sb'] as const).map((k) => (
                    <td key={k}>{team.batters.reduce((s, p) => s + p[k], 0)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <h4>투구</h4>
          <div className="box-table-scroll" tabIndex={0} role="region" aria-label="투수 경기 기록">
            <table>
              <thead>
                <tr>
                  {['선수', '이닝', '피안타', '실점', '볼넷', '탈삼진'].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.pitchers.map((p) => (
                  <tr key={p.id}>
                    <th>
                      <Link href={`/players/${encodeURIComponent(p.id)}`}>{p.name}</Link>
                    </th>
                    <td>
                      {Math.floor(p.outs / 3)}
                      {p.outs % 3 ? ` ${p.outs % 3}/3` : ''}
                    </td>
                    {[p.h, p.r, p.bb, p.k].map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="box-score-note">
            게임에 기록된 플레이 기준입니다. 이닝의 1/3은 아웃 1개이며, 투수 실점은 실점 당시 등판
            투수에게 집계합니다.
          </small>
        </>
      )}
    </section>
  );
}
