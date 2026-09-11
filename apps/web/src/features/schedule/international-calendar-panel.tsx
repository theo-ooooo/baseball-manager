import { isUnemployed } from '@dugout/shared/manager-career';
import { internationalCalendar } from '@dugout/shared/international';
import { gameDate } from '@dugout/shared/calendar';
import type { GameState } from '@dugout/shared/types';

export function InternationalCalendarPanel({ g }: { g: GameState }) {
  const events = internationalCalendar(g.year),
    today = gameDate(g);
  if (!events.length) return null;
  return (
    <section className="panel international-calendar" aria-label="국제대회 일정">
      <div className="panel-header">
        <h2>국제대회 · 대표팀 차출</h2>
        <span>{g.year} 시즌</span>
      </div>
      <div className="international-event-list">
        {events.map((event) => {
          const selection = g.international?.events.find((e) => e.id === event.id);
          return (
            <article key={event.id}>
              <div>
                <span className="international-status">
                  {today >= event.returnDate
                    ? '종료'
                    : today >= event.departure
                      ? '대표팀 일정 진행 중'
                      : '예정'}
                  {event.estimated ? ' · 게임 일정' : ''}
                </span>
                <h3>{event.name}</h3>
                <p>
                  {event.start} ~ {event.end}
                </p>
              </div>
              <dl>
                <div>
                  <dt>대표팀 합류</dt>
                  <dd>{event.departure}</dd>
                </div>
                <div>
                  <dt>구단 복귀</dt>
                  <dd>{event.returnDate}</dd>
                </div>
                <div>
                  <dt>우리 선수</dt>
                  <dd>
                    {isUnemployed(g)
                      ? '소속 없음'
                      : selection
                        ? `${g.roster.filter((p) => selection.players.includes(p.id)).length}명`
                        : '명단 발표 전'}
                  </dd>
                </div>
              </dl>
              <a href={event.source} target="_blank" rel="noreferrer">
                대회 안내 ↗
              </a>
            </article>
          );
        })}
      </div>
      <details>
        <summary>대표 선발과 차출 운영 기준</summary>
        <p>
          게임 내 국적·능력·포지션을 기준으로 선발하며, 구단 전력 유지를 위해 한 구단에서 최대 3명을
          차출합니다. 출국 준비 3일과 대회 뒤 복귀 2일을 포함합니다. 대표팀 경기를 직접 지휘하거나
          메달을 결정하는 모드는 아닙니다.
        </p>
        <p>
          2026 아시안게임 한국 대표는 25세 이하와 최대 3명의 29세 이하 와일드카드를 사용합니다. 프로
          입단 연차와 복수 국적 자격은 반영되지 않으며, 일본 실업 대표는 현재 선수 명단에 포함돼
          있지 않습니다.
        </p>
        <p>
          올림픽은 2028년 대회만 편성합니다. 미확정 출전국은 게임 내 국가 전력으로 정하며,
          프리미어12는 MLB 소속 선수를 제외합니다. 프리미어12 날짜와 향후 WBC·아시안게임 일정은
          게임에서 정한 일정입니다.
        </p>
      </details>
    </section>
  );
}
