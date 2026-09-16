import Link from 'next/link';
import type { GameState, NewsItem } from '@dugout/shared/types';
import { vacationSummaryModel } from './vacation-summary-model';

function ReportLinks({ reports }: { reports: NewsItem[] }) {
  return (
    <ul>
      {reports.map((n) => (
        <li key={n.id}>
          <Link href={`/?view=inbox&report=${encodeURIComponent(n.id)}`}>
            <span>{n.title}</span>
            <small>{n.date} · 열기 →</small>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function VacationReturnSummary({ g, news }: { g: GameState; news: NewsItem }) {
  const summary = vacationSummaryModel(g, news);
  if (!summary) return null;
  return (
    <section className="vacation-return-summary" aria-label="휴가 복귀 요약">
      <p>
        {news.vacationSummary!.from} ~ {news.vacationSummary!.through} · {summary.results.length}
        경기{' '}
        <b>
          {summary.wins}승 {summary.draws > 0 ? `${summary.draws}무 ` : ''}
          {summary.losses}패
        </b>
      </p>
      <h3>
        먼저 결정할 일 <span>{summary.decisions.length}</span>
      </h3>
      {summary.decisions.length ? (
        <ReportLinks reports={summary.decisions} />
      ) : (
        <p>
          {summary.currentClub
            ? '지금 답변을 기다리는 업무는 없습니다.'
            : '이전 구단의 휴가 기록입니다.'}
        </p>
      )}
      {summary.attention.length > 0 && (
        <>
          <h3>
            확인할 소식 <span>{summary.attention.length}</span>
          </h3>
          <ReportLinks reports={summary.attention} />
        </>
      )}
      <details>
        <summary>경기 · 일반 보고 {summary.routine.length}건 펼치기</summary>
        <ReportLinks reports={summary.routine} />
      </details>
    </section>
  );
}
