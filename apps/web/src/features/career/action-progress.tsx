'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { isInboxReadCommand } from '@dugout/shared/inbox-commands';

const labels: Record<string, string> = {
  start: '새 커리어를 준비하고 있습니다',
  beginSeriesDelegation: '연전 일정과 선수단을 확인하고 있습니다',
  delegateSeriesDay: '코치가 연전을 지휘하고 있습니다',
  followProspect: '육성 선수와 목표를 기록하고 있습니다',
  setDefensivePlan: '오늘 경기의 수비 대응을 저장하고 있습니다',
  startRemodel: '선수와 코치에게 개조 계획을 전달하고 있습니다',
  cancelRemodel: '폼 개조를 중단하고 있습니다',
  reviseDeadlineTrade: '경쟁 구단의 조건과 수정 제안을 검토하고 있습니다',
  respondCompetition: '주전 경쟁 방침을 선수들에게 전달하고 있습니다',
  lineup: '타순을 저장하고 있습니다',
  tactic: '전술을 적용하고 있습니다',
  instructions: '팀 지시를 적용하고 있습니다',
  teamInstructions: '팀 지시를 적용하고 있습니다',
  defense: '수비 배치를 저장하고 있습니다',
  starter: '선발 투수를 변경하고 있습니다',
  reviseMatch: '변경한 선수·전술로 이후 경기를 준비하고 있습니다',
  matchCommand: '벤치 작전을 전달하고 있습니다',
  cancelMatchCommand: '작전 지시를 취소하고 있습니다',
  startMatch: '경기 기록을 준비하고 있습니다',
  completeMatch: '경기 결과를 저장하고 있습니다',
  matchConversation: '인터뷰와 팀 메시지를 전달하고 있습니다',
  continueDay: '다음 날짜를 진행하고 있습니다',
  skipPreseason: '남은 프리시즌을 코치진에게 맡기고 개막을 준비하고 있습니다',
  readNews: '보고를 확인하고 있습니다',
};
export function ActionProgress({
  action,
  phase,
}: {
  action: string | null;
  phase: 'request' | 'response';
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!action) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [action]);
  if (!action || isInboxReadCommand(action) || typeof document === 'undefined') return null;
  return createPortal(
    <div className="action-progress" role="status" aria-live="polite" aria-atomic="true">
      <div className="action-progress-rail" role="progressbar" aria-label="요청 처리 중">
        <span />
      </div>
      <div className="action-progress-message">
        <LoaderCircle size={22} className="spin" aria-hidden="true" />
        <div>
          <strong>{labels[action] || '변경 사항을 저장하고 있습니다'}</strong>
          <small>
            {slow
              ? '응답을 기다리고 있습니다. 완료되면 자동으로 반영됩니다.'
              : phase === 'response'
                ? '저장한 내용을 화면에 반영하고 있습니다.'
                : '처리 중입니다. 잠시만 기다려 주세요.'}
          </small>
        </div>
      </div>
    </div>,
    document.body,
  );
}
