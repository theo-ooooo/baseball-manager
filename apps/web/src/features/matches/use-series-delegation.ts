'use client';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
export function useSeriesDelegation(g: GameState | null, act: Act, busy: boolean) {
  const [open, setOpen] = useState(false),
    [running, setRunning] = useState(false);
  const active = useRef(false),
    cancel = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel.current = true;
    };
  }, []);
  async function run(resume = false) {
    if (!g || busy || active.current) return;
    if (document.querySelector('[data-unsaved-plan="true"]')) {
      toast.info('작성 중인 명단을 먼저 저장해 주세요.');
      return;
    }
    active.current = true;
    cancel.current = false;
    setOpen(false);
    setRunning(true);
    try {
      let current = resume ? g : await act({ type: 'beginSeriesDelegation' });
      for (
        let i = 0;
        current?.engagement?.seriesRun?.status === 'running' && i < 15 && !cancel.current;
        i++
      )
        current = await act({ type: 'delegateSeriesDay' });
      if (cancel.current && mounted.current && current?.engagement?.seriesRun?.status === 'running')
        await act({ type: 'stopSeriesDelegation' });
    } finally {
      active.current = false;
      if (mounted.current) setRunning(false);
    }
  }
  return {
    open,
    setOpen,
    running,
    run,
    pause: () => {
      cancel.current = true;
    },
    saved: g?.engagement?.seriesRun,
  };
}
