'use client';
import { useMemo, useRef, useState } from 'react';
import { isDateProgressCommand } from '@dugout/shared/inbox-read-intent';
import { useInboxReadQueue } from '../inbox/use-inbox-read-queue';
import { careerMemory } from './career-memory';
import { toast } from 'sonner';
import { isManagerConversationCommand } from '@dugout/shared/manager-commands';
import { isInboxCommand } from '@dugout/shared/inbox-commands';
import { isLiveMatchCommand } from '@dugout/shared/live-match-commands';
import { careerResponse, mergeCareerResponse, careerErrorMessage } from './career-response';
import type { Act, CareerData } from './game-contracts';

export function useCareerSession(initial: CareerData) {
  const [data, setData] = useState(initial);
  const { viewed } = useInboxReadQueue(data.state);
  const visibleState = useMemo(
    () =>
      data.state && viewed.size
        ? {
            ...data.state,
            news: data.state.news.map((n) => (viewed.has(n.id) ? { ...n, read: true } : n)),
          }
        : data.state,
    [data.state, viewed],
  );
  const current = useRef(initial),
    locked = useRef(false);
  const retry = useRef<{ key: string; payload: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [saveFailed, setSaveFailed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [requestPhase, setRequestPhase] = useState<'request' | 'response'>('request');
  function install(next: CareerData) {
    careerMemory.career(next);
    current.current = next;
    setData(next);
  }
  async function read() {
    const response = await fetch('/api/career', { cache: 'no-store' });
    const next = await careerResponse(response);
    if (!response.ok) throw new Error(next.error || '커리어를 불러오지 못했습니다.');
    install(next);
    retry.current = null;
    return next as CareerData;
  }
  async function load() {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError('');
    try {
      await read();
    } catch (e) {
      setError(careerErrorMessage(e));
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  const act: Act = async (action) => {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    setPendingAction(String(action.type));
    setRequestPhase('request');
    // If a response was lost, retry the same command with the same journal id. This covers
    // commits that completed before a network interruption or Worker termination.
    const key = JSON.stringify(action);
    const payload =
      retry.current?.key === key
        ? retry.current.payload
        : {
            ...action,
            ...(['startMatch', 'delegateMatch'].includes(String(action.type))
              ? { matchCards: true }
              : {}),
            ...(isDateProgressCommand(action.type)
              ? { readNewsIds: [...careerMemory.inbox.snapshot()] }
              : {}),
            responseMode:
              isManagerConversationCommand(action.type) ||
              isInboxCommand(action.type) ||
              isLiveMatchCommand(action.type)
                ? 'patch'
                : 'compact',
            revision: current.current.revision,
            requestId: crypto.randomUUID(),
          };
    retry.current = { key, payload };
    try {
      const response = await fetch('/api/career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setRequestPhase('response');
      const next = await careerResponse(response);
      if (!response.ok) {
        if (response.status === 409) {
          if ('state' in next) install(next);
          else if (next.reload) await read();
        }
        if (response.status < 500) retry.current = null;
        throw new Error(next.error || next.message || '요청을 처리하지 못했습니다.');
      }
      const merged = mergeCareerResponse(current.current, next);
      install(merged);
      retry.current = null;
      setSaveFailed(false);
      return merged.state;
    } catch (e) {
      setSaveFailed(true);
      toast.error(careerErrorMessage(e));
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
      setPendingAction(null);
    }
  };
  return {
    g: visibleState,
    ledger: data.ledger,
    loading,
    error,
    busy,
    saveFailed,
    pendingAction,
    requestPhase,
    load,
    act,
  };
}
