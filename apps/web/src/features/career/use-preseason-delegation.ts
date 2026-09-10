'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { GameState } from '@dugout/shared/game-view';
import type { Act } from './game-contracts';

type PreseasonDelegationOptions = {
  game: GameState | null;
  busy: boolean;
  progressing: boolean;
  act: Act;
  closeProgress: () => void;
  openReport: (id?: string) => void;
  openMatchday: () => void;
};

/** Own the delegation dialog and its request/response flow; simulation stays on the server. */
export function usePreseasonDelegation({
  game: g,
  busy,
  progressing,
  act,
  closeProgress,
  openReport,
  openMatchday,
}: PreseasonDelegationOptions) {
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipFuture, setSkipFuture] = useState(false);
  /** Hand the remaining preseason to the coaches; the server stops on opening day or at a new offer. */
  async function delegatePreseason() {
    if (!g || g.liveMatch || busy || progressing || g.phase !== 'preseason') return;
    if (document.querySelector('[data-unsaved-plan="true"]')) {
      toast.error('변경한 타순·전술을 적용하거나 되돌린 뒤 진행해 주세요.');
      return;
    }
    setSkipOpen(false);
    closeProgress();
    const next = await act({ type: 'skipPreseason', futureSeasons: skipFuture });
    if (!next) return;
    const arrived = next.progress?.newsIds || [];
    // Interrupted: land on the contact that needs the manager, not on the delegation summary.
    const report =
      (next.progress?.stop === 'report'
        ? next.news.find((n) => arrived.includes(n.id) && n.managerOfferId)?.id
        : undefined) || arrived[0];
    if (next.progress?.stop === 'season') {
      toast.success(
        `${next.progress.to - next.progress.from}일을 코치진에게 맡기고 개막일에 도착했습니다.`,
      );
      if (report) openReport(report);
      else openMatchday();
    } else {
      toast.info('감독의 답변이 필요한 연락이 도착해 개막 전에 멈췄습니다.');
      openReport(report);
    }
  }

  return { skipOpen, setSkipOpen, skipFuture, setSkipFuture, delegatePreseason };
}
