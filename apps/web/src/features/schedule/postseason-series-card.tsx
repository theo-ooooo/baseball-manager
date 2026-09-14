import type { PostseasonFixture, PostseasonSeries } from '@dugout/shared/postseason';
import { postseasonWinner } from '@dugout/shared/postseason';
import { ClubBadge } from '../../components/club-badge';
import { useWorld } from '../career/world-context';

export function PostseasonSeriesCard({
  series,
  fixtures,
  target,
  ownClub,
}: {
  series: PostseasonSeries;
  fixtures: PostseasonFixture[];
  target: number;
  ownClub: string;
}) {
  const { getClub } = useWorld();
  return (
    <article className="postseason-series">
      {[
        { id: series.a, wins: series.aw },
        { id: series.b, wins: series.bw },
      ].map((side) => (
        <div
          key={side.id}
          className={`postseason-team ${side.id === ownClub ? 'own' : ''} ${postseasonWinner(series, target) === side.id ? 'winner' : ''}`}
        >
          <ClubBadge club={getClub(side.id)} size="small" />
          <strong>{getClub(side.id).name}</strong>
          <span className="postseason-wins" aria-label={`${side.wins}승`}>
            {Array.from(
              { length: target - (side.id === series.a ? series.advantageA || 0 : 0) },
              (_, i) => (
                <i key={i} className={i < side.wins ? 'won' : ''} />
              ),
            )}
          </span>
          <b>{side.wins}</b>
        </div>
      ))}
      <div className="postseason-game-list">
        {!!series.advantageA && (
          <p className="postseason-advantage">4위: 1승 또는 1무면 진출 · 5위: 2승 필요</p>
        )}
        {fixtures.map((f) => (
          <div key={f.id} className={f.status === 'cancelled' ? 'not-played' : ''}>
            <span>
              {f.game}차전 · {f.date.slice(5).replace('-', '/')}
            </span>
            <span>
              {f.status === 'completed'
                ? `${getClub(f.away).short} ${f.score!.away} : ${f.score!.home} ${getClub(f.home).short}`
                : f.status === 'cancelled'
                  ? '미개최 · 시리즈 종료'
                  : `${getClub(f.home).short} 홈 · ${f.status === 'conditional' ? '필요 시' : '예정'}`}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
