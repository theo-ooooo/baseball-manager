import type { Result } from '@dugout/shared/types';
import { matchManagerReview } from '@dugout/shared/match-manager-review';
import { useWorld } from '../career/world-context';
const stamp = (row: { inning: number; half: number }) =>
  `${row.inning}회 ${row.half ? '말' : '초'}`;
export function MatchManagerReview({ result }: { result: Result }) {
  const { getClub } = useWorld();
  return (
    <section className="manager-match-review" aria-label="경기 후 작전 복기">
      <header>
        <div>
          <small>경기 후 보고</small>
          <h3>작전 복기</h3>
        </div>
        <span>
          {result.delegatedBy ? `${result.delegatedBy}에게 맡긴 경기` : '사인 · 카드 · 투수 운용'}
        </span>
      </header>
      <p className="person-profile-note">
        실제 사용 기록과 그 장면의 결과입니다. 양 팀 모두 같은 카드·증강 규칙을 적용합니다.
      </p>
      <div className="manager-review-teams">
        {[result.away, result.home].map((club) => {
          const review = matchManagerReview(result, club);
          return (
            <article key={club}>
              <h4>{getClub(club).name}</h4>
              <div className="manager-review-counts">
                <strong>
                  승부 카드 {review.cards.filter((c) => c.row).length} / {review.cards.length}
                </strong>
                <span>사인 {review.commands.length}회</span>
              </div>
              <ul className="manager-review-cards">
                {review.cards.map((card) => (
                  <li key={card.id}>
                    <div>
                      <b>{card.name}</b>
                      <small>
                        {card.grade} · {card.row ? `${stamp(card.row)} 사용` : '사용 기록 없음'}
                      </small>
                    </div>
                    {card.row && <p>{card.row.text}</p>}
                  </li>
                ))}
              </ul>
              {!review.cards.length && (
                <p className="person-profile-note">이 경기에는 승부 카드 기록이 없습니다.</p>
              )}
              {review.augmentation && (
                <div className="manager-review-augmentation">
                  <b>{review.augmentation.name}</b>
                  <span>
                    {review.augmentation.row
                      ? `${stamp(review.augmentation.row)} · ${review.augmentation.row.play?.augmentations?.blocked ? '상대 카드로 무효화' : '1회 발동'}`
                      : review.augmentation.legacy
                        ? '이전 버전 · 경기 적용'
                        : '발동 기록 없음'}
                  </span>
                </div>
              )}
              {review.highlights.map((sign) => (
                <div className="manager-review-highlight" key={sign.id}>
                  <small>
                    {stamp(sign)} · {sign.source}
                  </small>
                  <strong>
                    {sign.command} → {sign.success ? '작전 성공 · ' : ''}
                    {sign.label}
                  </strong>
                  <p>
                    {sign.player}
                    {sign.detail ? ` · ${sign.detail}` : ''}
                  </p>
                </div>
              ))}
              <details>
                <summary>사인과 결과 · {review.commands.length}건</summary>
                {!review.commands.length && <p>기록된 사인이 없습니다.</p>}
                <ol className="manager-review-signs">
                  {review.commands.map((sign) => (
                    <li key={sign.id} className={sign.success ? 'successful' : ''}>
                      <small>
                        {stamp(sign)} · {sign.source}
                      </small>
                      <div>
                        <b>{sign.command}</b>
                        <strong>
                          {sign.success ? '작전 성공 · ' : ''}
                          {sign.label}
                        </strong>
                      </div>
                      <p>
                        {sign.player}
                        {sign.detail ? ` · ${sign.detail}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
              <details>
                <summary>
                  투수·선수 운용 · {review.substitutions.length + review.manualChanges.length}건
                </summary>
                <ul>
                  {review.substitutions.map((row, index) => (
                    <li key={index}>
                      {stamp(row)} · 자동 투수 교체 후 {row.text}
                    </li>
                  ))}
                  {review.manualChanges.map((change, index) => (
                    <li key={`${change.cursor}:${index}`}>
                      {result.log[change.cursor] ? stamp(result.log[change.cursor]) : '경기 중'} ·
                      감독의 선수·수비·전술 변경
                    </li>
                  ))}
                </ul>
                {!review.substitutions.length && !review.manualChanges.length && (
                  <p>별도 운용 변경 기록이 없습니다.</p>
                )}
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
