import type { GameState, Player } from '@dugout/shared/types';
import {
  abilityAverage,
  abilityKeys,
  abilityLabels,
  developmentChange,
  growthLabels,
  growthPatterns,
} from '@dugout/shared/development';
import { coachSkill } from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import { isUnrated } from '@dugout/shared/ratings';

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
export function DevelopmentBadge({ player }: { player: Player }) {
  const d = player.development;
  if (!d) return null;
  return (
    <span
      className={`development-badge ${d.stage}`}
      title={`게임 내 성장 유형 · ${growthPatterns[d.pattern]}`}
    >
      {growthLabels[d.stage]}
    </span>
  );
}
export function DevelopmentPanel({ player: p, game: g }: { player: Player; game: GameState }) {
  const d = p.development;
  if (!d)
    return (
      <section className="profile-evidence">
        <h3>성장 관찰</h3>
        <p>구단에 합류하면 현재 능력부터 성장 기록을 쌓습니다.</p>
      </section>
    );
  const first = d.history.length > 1 ? d.history.at(-2)! : d.history[0];
  const change = developmentChange(p) || 0;
  const points = [
    ...d.history
      .filter((r) => r.date !== gameDate(g))
      .map((r) => ({ date: r.date, value: r.overall })),
    { date: gameDate(g), value: abilityAverage(p) },
  ];
  const low = Math.max(20, Math.floor(Math.min(...points.map((p) => p.value)) - 1));
  const high = Math.min(99, Math.ceil(Math.max(...points.map((p) => p.value)) + 1));
  const coords = points.map((p, i) => ({
    x: 35 + (i * 590) / Math.max(1, points.length - 1),
    y: 135 - ((p.value - low) * 110) / Math.max(1, high - low),
    ...p,
  }));
  const keys = abilityKeys.filter((k) =>
    p.pos === 'P'
      ? ['stuff', 'control', 'field', 'speed'].includes(k)
      : !['stuff', 'control'].includes(k),
  );
  const advice =
    d.stage === 'growth'
      ? '경기에 꾸준히 출전하며 주력 능력을 키울 시기입니다. 1군 출전이 적으면 2군에서 경기 경험을 쌓게 해 주세요.'
      : d.stage === 'peak'
        ? '현재 전력을 유지할 시기입니다. 주력 능력과 수비 숙련도를 다듬고 피로를 관리해 주세요.'
        : '하락 속도를 관리할 시기입니다. 체력 코치와 회복 훈련을 활용하고 출전 부담을 나눠 주세요.';
  return (
    <section className="development-panel">
      <div className="development-summary">
        <div>
          <small>현재 성장 단계</small>
          <h3>
            <DevelopmentBadge player={p} /> {growthPatterns[d.pattern]}
          </h3>
          <p>{advice}</p>
        </div>
        <div className="development-change">
          <small>{first.date.slice(5)} 이후 능력 변화</small>
          <strong className={change < 0 ? 'decline' : 'growth'}>
            {isUnrated(p) ? '관찰 중' : signed(change)}
          </strong>
          <span>게임 OVR · 소수점 변화</span>
        </div>
      </div>
      <ol className="development-stages" aria-label="성장 단계">
        {Object.entries(growthLabels).map(([key, label]) => (
          <li key={key} aria-current={key === d.stage ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <div className="development-factors">
        <div>
          <small>육성 환경</small>
          <strong>{p.squad === 'reserve' ? '2군 경기 · 육성' : '1군 훈련 · 출전'}</strong>
        </div>
        <div>
          <small>{p.pos === 'P' ? '투수' : '타격'} 코치 능력</small>
          <strong>{Math.round(coachSkill(g, p.pos === 'P' ? '투수' : '타격'))}</strong>
        </div>
        <div>
          <small>컨디션</small>
          <strong>{Math.round(p.condition)}%</strong>
        </div>
      </div>
      {!isUnrated(p) && (
        <>
          <h3>능력 변화 기록</h3>
          {points.length > 1 ? (
            <figure className="development-chart">
              <svg
                viewBox="0 0 650 165"
                role="img"
                aria-label={`${p.name}의 실제 저장된 능력 기록 ${points.length}개. ${points[0].value.toFixed(2)}에서 ${abilityAverage(p).toFixed(2)}로 변화`}
              >
                {[low, high].map((v) => (
                  <g key={v}>
                    <text x="2" y={v === low ? 139 : 29}>
                      {v}
                    </text>
                    <line x1="30" x2="632" y1={v === low ? 135 : 25} y2={v === low ? 135 : 25} />
                  </g>
                ))}
                <polyline points={coords.map((p) => `${p.x},${p.y}`).join(' ')} />
                {coords.map((p) => (
                  <circle key={p.date} cx={p.x} cy={p.y} r="3">
                    <title>
                      {p.date} · {p.value.toFixed(2)}
                    </title>
                  </circle>
                ))}
                <text x="35" y="158">
                  {points[0].date}
                </text>
                <text x="625" y="158" textAnchor="end">
                  {points.at(-1)!.date}
                </text>
              </svg>
              <figcaption>4주마다 관찰 기록을 저장합니다. 마지막 점은 현재 능력입니다.</figcaption>
            </figure>
          ) : (
            <p className="development-empty">
              오늘부터 관찰을 시작합니다. 날짜를 진행하면 변화가 쌓입니다.
            </p>
          )}
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>능력</th>
                  <th>관찰 시작</th>
                  <th>현재</th>
                  <th>변화</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k}>
                    <td>{abilityLabels[k]}</td>
                    <td>{first.abilities[k].toFixed(2)}</td>
                    <td>{p[k].toFixed(2)}</td>
                    <td className={p[k] < first.abilities[k] ? 'decline' : 'growth'}>
                      {signed(p[k] - first.abilities[k])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="profile-note">
        성장 유형과 단계는 이 커리어의 게임 설정입니다. 실제 선수의 미래 성적을 예측하는 자료가
        아닙니다. 훈련·출전 기회·코치·컨디션에 따라 변화하며, 기존 능력과 성적은 유지한 채 관찰을
        시작합니다.{isUnrated(p) && ' 기초 평가 자료가 부족해 수치 변화 표시는 보류합니다.'}
      </p>
    </section>
  );
}
