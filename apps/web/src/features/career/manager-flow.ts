import type { GameState } from '@dugout/shared/types';
import { newsNeedsAction } from '../inbox/inbox-model';

export type ManagerStep = {
  kind: 'decision' | 'report' | 'matchday' | 'media' | 'live' | 'season' | 'continue';
  label: string;
  detail: string;
  reportId?: string;
};

/** Read-only navigation decisions. Opening a screen must never advance the career. */
export function managerStep(g: GameState, hasFixture: boolean, view: string): ManagerStep {
  if (g.liveMatch)
    return {
      kind: 'live',
      label: '경기 진행 중',
      detail: '경기를 마치면 경기 후 보고로 이어집니다.',
    };
  const decision = g.news.find((n) => n.choiceKind && !n.choice);
  if (decision)
    return { kind: 'decision', label: '필수 답변', detail: decision.title, reportId: decision.id };
  const unread = g.news.filter((n) => !n.read);
  if (g.media?.pending) {
    const matchReport = unread.find(
      (n) => n.kind === 'match' && `post:${n.matchId}` === g.media!.pending!.key,
    );
    return matchReport
      ? {
          kind: 'report',
          label: '경기 후 보고',
          detail: matchReport.title,
          reportId: matchReport.id,
        }
      : {
          kind: 'media',
          label: '경기 후 인터뷰',
          detail: '취재진과 선수단에 경기 평가를 전하고 다음 일정을 준비하세요.',
        };
  }
  const report = unread.find((n) => newsNeedsAction(n, g)) || unread[0];
  if (report)
    return {
      kind: 'report',
      label: `보고 확인 · ${unread.length}`,
      detail: report.title,
      reportId: report.id,
    };
  if (g.phase === 'finished')
    return {
      kind: 'season',
      label: '다음 시즌',
      detail: '재계약과 선수단을 점검하고 새 시즌을 시작하세요.',
    };
  if (hasFixture)
    return {
      kind: 'matchday',
      label: view === 'matchday' ? '선수단 제출 · 경기장으로' : '경기 준비',
      detail: '오늘 경기의 선발·타순·컨디션을 확인하고 경기장으로 이동합니다.',
    };
  return {
    kind: 'continue',
    label: '계속 진행',
    detail: '다음 경기·새 보고·필수 결정이 생길 때까지 날짜를 진행합니다.',
  };
}

export function matchReportId(before: GameState, after: GameState) {
  const previous = new Set(before.news.map((n) => n.id));
  return after.news.find((n) => n.kind === 'match' && !previous.has(n.id))?.id;
}
