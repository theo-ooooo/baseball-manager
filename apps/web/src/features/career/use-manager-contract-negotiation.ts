'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GameState } from '@dugout/shared/types';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { finalManagerTerms, lastManagerProposal } from '@dugout/shared/manager-career';
import { fromManwon, toManwon } from '@dugout/shared/game-view';
import type { Act } from './game-contracts';

function useOfferMoney(initial: number) {
  const [unit, setUnit] = useState(toManwon(initial) >= 10000 ? '억 원' : '만 원');
  const [value, setValue] = useState(String(toManwon(initial) / (unit === '억 원' ? 10000 : 1)));
  const amount =
    value.trim() === '' ? NaN : fromManwon(Number(value) * (unit === '억 원' ? 10000 : 1));
  const setAmount = (next: number) =>
    setValue(String(toManwon(next) / (unit === '억 원' ? 10000 : 1)));
  return {
    unit,
    value,
    amount,
    setValue,
    setAmount,
    changeUnit(next: string) {
      if (Number.isFinite(amount))
        setValue(String(toManwon(amount) / (next === '억 원' ? 10000 : 1)));
      setUnit(next);
    },
  };
}
export function useManagerContractNegotiation(
  g: GameState,
  o: ManagerOffer,
  act: Act,
  busy: boolean,
) {
  const t = o.contractTerms,
    router = useRouter();
  const current = {
    salary: t?.salary ?? o.salary,
    signingBonus: t?.signingBonus ?? o.signingBonus ?? 0,
    years: t?.years || 1,
    targetRank: t?.targetRank || o.targetRank,
  };
  const previous = lastManagerProposal(o);
  const initial = previous || current;
  const salary = useOfferMoney(initial.salary),
    bonus = useOfferMoney(initial.signingBonus || 0);
  const [years, setYears] = useState(initial.years),
    [target, setTarget] = useState(String(initial.targetRank));
  const [signing, setSigning] = useState(false),
    [ink, setInk] = useState(false);
  const submitting = useRef(false);
  const agreed = t?.status === 'agreed',
    waiting = t?.status === 'pending',
    final = finalManagerTerms(t);
  const valid =
    Number.isFinite(salary.amount) &&
    salary.amount > 0 &&
    salary.amount <= o.salary * 3 &&
    Number.isFinite(bonus.amount) &&
    bonus.amount >= 0 &&
    bonus.amount <= o.salary * 3;
  const changed =
    toManwon(salary.amount) !== toManwon(current.salary) ||
    toManwon(bonus.amount) !== toManwon(current.signingBonus) ||
    years !== current.years ||
    Number(target) !== current.targetRank;
  async function send(type: string) {
    if (busy || submitting.current || (waiting && type !== 'declineManager')) return;
    if (type === 'negotiateManagerContract' && (!valid || !changed || final || agreed)) return;
    submitting.current = true;
    try {
      const result = await act({
        type,
        id: o.id,
        termsVersion: t?.version || 1,
        ...(type === 'negotiateManagerContract'
          ? { salary: salary.amount, signingBonus: bonus.amount, years, targetRank: Number(target) }
          : {}),
        ...(type === 'signManager' ? { signature: g.manager } : {}),
      });
      if (result && type === 'signManager') router.push('/?view=home');
    } finally {
      submitting.current = false;
    }
  }
  return {
    t,
    previous,
    current,
    salary,
    bonus,
    years,
    setYears,
    target,
    setTarget,
    signing,
    setSigning,
    ink,
    setInk,
    agreed,
    waiting,
    final,
    valid,
    changed,
    send,
    reset() {
      salary.setAmount(current.salary);
      bonus.setAmount(current.signingBonus);
      setYears(current.years);
      setTarget(String(current.targetRank));
    },
  };
}
