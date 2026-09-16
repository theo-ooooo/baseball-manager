import { stopsForReport } from '@dugout/shared/career-pace';
import { unreadBeforeMatch } from '@dugout/shared/match-inbox';
import type { GameState } from '@dugout/shared/types';
import { orderedInbox } from '../inbox/inbox-order';

export type ManagerStep = {
  kind:
    | 'decision'
    | 'report'
    | 'matchday'
    | 'media'
    | 'live'
    | 'season'
    | 'continue'
    | 'contractReply'
    | 'contract';
  label: string;
  detail: string;
  reportId?: string;
  offerId?: string;
};

/** A finished career needs a reply/signature before opening the next season. */
export function managerRenewalStep(g: GameState): ManagerStep | undefined {
  if (g.phase !== 'finished') return undefined;
  const renewal = g.managerCareer?.offers.find(
    (offer) => offer.source === 'renewal' && offer.club === g.club && offer.status === 'offered',
  );
  if (renewal?.contractTerms?.status === 'pending')
    return {
      kind: 'contractReply',
      label: '재계약 답변까지 진행',
      offerId: renewal.id,
      detail: '하루를 진행하고 이사회의 수정 제안 답변을 확인합니다.',
    };
  if (renewal && g.managerCareer?.contract && g.managerCareer.contract.throughYear <= g.year)
    return {
      kind: 'contract',
      label: renewal.contractTerms?.status === 'agreed' ? '재계약 서명' : '재계약 조건 확인',
      offerId: renewal.id,
      detail: '이사회 답변을 확인하고 계약에 서명하거나 제안을 거절해 주세요.',
    };
}

/** Read-only navigation decisions. Opening a screen must never advance the career. */
export function managerStep(g: GameState, hasFixture: boolean, view: string): ManagerStep {
  if (g.liveMatch)
    return {
      kind: 'live',
      label: '경기 진행 중',
      detail: '경기를 마치면 경기 후 보고로 이어집니다.',
    };
  if (g.managerCareer?.vacationUntil && g.managerCareer.status !== 'unemployed')
    return {
      kind: 'continue',
      label: '휴가 마무리까지 진행',
      detail: `${g.managerCareer.vacationUntil} 복귀 후 모인 보고를 확인합니다.`,
    };
  if (g.managerCareer?.status === 'unemployed') {
    const unread = orderedInbox(g, g.news).filter((n) => !n.read && stopsForReport(g, n));
    const report = unread[0];
    if (report)
      return {
        kind: 'report',
        label: report.managerOfferId ? '구단 연락 확인' : `뉴스 확인 · ${unread.length}`,
        detail: report.title,
        reportId: report.id,
      };
    return {
      kind: 'continue',
      label: '계속 진행',
      detail: '세계의 뉴스와 새 구단의 연락을 기다립니다.',
    };
  }
  const decision = orderedInbox(g, g.news).find((n) => n.choiceKind && !n.choice);
  if (decision)
    return { kind: 'decision', label: '필수 답변', detail: decision.title, reportId: decision.id };
  const unread = hasFixture
    ? unreadBeforeMatch(g)
    : orderedInbox(g, g.news).filter((n) => !n.read && stopsForReport(g, n));
  if (g.media?.pending && (g.engagement?.interviews === 'manual' || !g.staff.length)) {
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
  const report = unread[0];
  if (report)
    return {
      kind: 'report',
      label: `${hasFixture ? '수신함 확인' : '보고 확인'} · ${unread.length}`,
      detail: report.title,
      reportId: report.id,
    };
  if (g.phase === 'finished') {
    const renewal = managerRenewalStep(g);
    if (renewal) return renewal;
    return {
      kind: 'season',
      label: '다음 시즌',
      detail: '재계약과 선수단을 점검하고 새 시즌을 시작하세요.',
    };
  }
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
