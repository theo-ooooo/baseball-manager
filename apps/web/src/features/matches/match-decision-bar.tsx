'use client';
import type { previousMatchCommand } from '@dugout/shared/match-commands';
import type { matchDecision } from '@dugout/shared/match-decision';
import type { MatchPauseReason } from './use-match-playback';
import type { ReactNode } from 'react';

export function MatchDecisionBar({
  decision,
  paused,
  pauseReason,
  busy,
  onPlan,
  onCommand,
  onContinue,
  previousCommand,
  onRepeat,
  coach,
}: {
  decision: ReturnType<typeof matchDecision>;
  paused: boolean;
  pauseReason: MatchPauseReason;
  busy: boolean;
  onPlan: () => void;
  onCommand: () => void;
  onContinue: () => void;
  previousCommand?: ReturnType<typeof previousMatchCommand>;
  onRepeat: () => void;
  coach?: ReactNode;
}) {
  if (!paused || decision.finished) return null;
  return (
    <section
      className={`match-decision ${decision.kind || 'paused'}`}
      aria-label="다음 타석 전 감독 결정"
      role="status"
    >
      <div>
        <strong>
          {pauseReason === 'ready'
            ? '재생 대기 · 계속 진행을 눌러주세요'
            : pauseReason === 'hidden'
              ? '화면 이탈 · 일시정지'
              : pauseReason !== 'automatic'
                ? '일시정지 · 감독 지시'
                : decision.kind === 'opportunity'
                  ? '득점 기회 · 자동 일시정지'
                  : decision.kind === 'threat'
                    ? '실점 위기 · 자동 일시정지'
                    : '일시정지 · 다음 타석 준비'}
        </strong>
        <span>{decision.situation}</span>
        <p>
          다음 타자 <b>{decision.batter || '타순 확인'}</b> · 투수{' '}
          {decision.pitcher || '마운드 확인'}
        </p>
      </div>
      {coach}
      {decision.kind && previousCommand && (
        <div className="match-repeat-command">
          <span>
            이전 사인 <b>‘{previousCommand.label}’</b>으로 계속하시겠습니까?
          </span>
          {previousCommand.reason ? (
            <small>{previousCommand.reason}</small>
          ) : (
            <button disabled={busy} onClick={onRepeat}>
              이전 사인 적용 · 경기 재개
            </button>
          )}
        </div>
      )}
      <div className="match-decision-actions">
        <button disabled={busy} onClick={onPlan}>
          {decision.attacking ? '대타 · 선수 교체' : '투수 · 수비 교체'}
        </button>
        <button disabled={busy} onClick={onCommand}>
          {decision.attacking ? '타자 작전' : '마운드 사인'}
        </button>
        <button disabled={busy} onClick={onContinue}>
          계속 진행 →
        </button>
      </div>
    </section>
  );
}
