'use client';
import type { Result } from '@dugout/shared/types';
import { playKind } from '@dugout/shared/replay';
import { useWorld } from '../career/world-context';

export function MatchOverview({ result, consumed }: { result: Result; consumed: number }) {
  const { getClub } = useWorld();
  const events = result.log.slice(0, consumed),
    last = events.at(-1);
  const totals = [0, 1].map((side) => {
    const plays = events.filter((e) => e.half === side && e.play?.plateAppearance !== false);
    return {
      hits: plays.filter((e) =>
        ['single', 'double', 'triple', 'homeRun'].includes(playKind(e.text)),
      ).length,
      walks: plays.filter((e) => playKind(e.text) === 'walk').length,
      strikeouts: plays.filter((e) => playKind(e.text) === 'strikeout').length,
    };
  });
  const innings = Array.from({ length: Math.max(9, last?.inning || 1) }, (_, i) => i + 1);
  return (
    <div className="match-overview">
      <h3>경기 현황</h3>
      <div className="match-linescore">
        <table>
          <thead>
            <tr>
              <th>팀</th>
              {innings.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th>R</th>
              <th>H</th>
            </tr>
          </thead>
          <tbody>
            {[result.away, result.home].map((club, side) => (
              <tr key={club}>
                <th>{getClub(club).short}</th>
                {innings.map((inning) => {
                  const entries = events.filter((e) => e.inning === inning && e.half === side);
                  const runs = entries.reduce(
                    (sum, e) =>
                      sum + (e.play ? e.play.after.score[side] - e.play.before.score[side] : 0),
                    0,
                  );
                  return <td key={inning}>{entries.length ? runs : '·'}</td>;
                })}
                <td>
                  <b>{last?.score[side] || 0}</b>
                </td>
                <td>{totals[side].hits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="match-comparison">
        <header>
          <span>{getClub(result.away).short}</span>
          <span>{getClub(result.home).short}</span>
        </header>
        {(
          [
            ['hits', '안타'],
            ['walks', '볼넷'],
            ['strikeouts', '삼진'],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <b>{totals[0][key]}</b>
            <span>{label}</span>
            <b>{totals[1][key]}</b>
          </div>
        ))}
      </div>
      <div className="match-coach-note">
        <small>더그아웃</small>
        <p>
          {!last
            ? '명단 확인이 끝나면 플레이볼을 눌러 경기를 시작하세요.'
            : last.play?.after.outs === 3
              ? '공수가 교대됩니다. 다음 이닝의 투수와 타순을 확인하세요.'
              : last.play?.energy && last.play.energy.pitcher[1] < 45
                ? '현재 투수의 체력이 떨어졌습니다. 투구 내용과 다음 타순을 보고 불펜 교체를 검토하세요.'
                : last.play?.after.bases.some(Boolean)
                  ? '주자가 나갔습니다. 아웃 카운트와 점수 차를 보고 작전을 선택하세요.'
                  : '타석이 끝날 때마다 경기 흐름을 확인하고 선수·전술에서 다음 승부를 준비할 수 있습니다.'}
        </p>
      </div>
      <small className="match-stat-note">완료된 플레이 기준</small>
    </div>
  );
}
