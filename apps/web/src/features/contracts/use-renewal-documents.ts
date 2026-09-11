'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { fromManwon, toManwon } from '@dugout/shared/game-view';
import { renewalUnavailableReason } from '@dugout/shared/contract-status';
import type { GameState } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';

export function useRenewalDocuments() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

export function useRenewalDraft(g: GameState, act: Act, busy: boolean, close: () => void) {
  const { agentFor } = useWorld();
  const candidates = g.roster.filter((p) => p.years === 1);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(
      candidates.map((p) => [
        p.id,
        {
          selected: !renewalUnavailableReason(g, p),
          salary: String(toManwon(p.salary * 1.1)),
          years: 3,
        },
      ]),
    ),
  );
  const [increase, setIncrease] = useState('10');
  const [period, setPeriod] = useState(3);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const locked = busy || sending;
  const rows = candidates.map((p) => ({
    player: p,
    reason: renewalUnavailableReason(g, p),
    ...draft[p.id],
    amount: fromManwon(Number(draft[p.id]?.salary)),
  }));
  const selected = rows.filter((row) => !row.reason && row.selected);
  const valid =
    selected.length > 0 &&
    selected.every(
      (row) =>
        Number.isFinite(row.amount) &&
        row.amount > 0 &&
        row.amount <= 1e8 &&
        Number.isInteger(row.years) &&
        row.years >= 1 &&
        row.years <= 5,
    );
  const current = selected.reduce((sum, row) => sum + row.player.salary, 0);
  const annual = selected.reduce((sum, row) => sum + row.amount, 0);
  const guaranteed = selected.reduce((sum, row) => sum + row.amount * row.years, 0);
  const cost = selected.reduce(
    (sum, row) => sum + Math.round(row.amount * agentFor(row.player).fee) + row.amount * 0.05,
    0,
  );
  const payroll = g.roster.reduce((sum, p) => sum + p.salary, 0) - current + annual;
  const canSend = valid && cost <= g.budget && !locked;
  function update(id: string, change: Partial<(typeof draft)[string]>) {
    setDraft((old) => ({ ...old, [id]: { ...old[id], ...change } }));
  }
  function selectAll(value: boolean) {
    setDraft((old) =>
      Object.fromEntries(Object.entries(old).map(([id, row]) => [id, { ...row, selected: value }])),
    );
  }
  const adjustmentValid =
    increase.trim() !== '' &&
    Number.isFinite(Number(increase)) &&
    Number(increase) > -100 &&
    Number(increase) <= 200;
  function applyTerms() {
    if (locked || !adjustmentValid) return;
    setDraft((old) =>
      Object.fromEntries(
        Object.entries(old).map(([id, row]) => {
          const player = selected.find((x) => x.player.id === id)?.player;
          return [
            id,
            player
              ? {
                  ...row,
                  salary: String(
                    Math.max(1, toManwon(player.salary * (1 + Number(increase) / 100))),
                  ),
                  years: period,
                }
              : row,
          ];
        }),
      ),
    );
  }
  async function send() {
    if (!canSend || submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      const next = await act({
        type: 'renewContracts',
        offers: selected.map((row) => ({
          id: row.player.id,
          salary: row.amount,
          years: row.years,
        })),
      });
      if (next) {
        toast.success(
          `${selected.length}명의 재계약 서류를 보냈습니다. 1~2일 뒤 답변을 확인하세요.`,
        );
        close();
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }
  return {
    rows,
    selected,
    valid,
    annual,
    guaranteed,
    cost,
    payroll,
    canSend,
    locked,
    update,
    selectAll,
    increase,
    setIncrease,
    period,
    setPeriod,
    adjustmentValid,
    applyTerms,
    send,
  };
}
