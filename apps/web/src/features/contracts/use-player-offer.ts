'use client';
import { useState } from 'react';
import type { Deal, GameState, Player } from '@dugout/shared/types';
import { askPrice, fromManwon, toManwon } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
export function usePlayerOffer(player: Player, g: GameState, deal: Deal | undefined, own: boolean) {
  const { agentFor } = useWorld();
  const [salary, setSalary] = useState(String(toManwon(deal?.salary ?? player.salary * 1.1))),
    [years, setYears] = useState(deal?.years ?? 3),
    [fee, setFee] = useState(String(toManwon(deal?.fee ?? askPrice(player))));
  const amount = fromManwon(Number(salary)),
    agentFee = Math.round(amount * agentFor(player).fee);
  const retained =
    deal?.stage === 'player' &&
    deal.seller &&
    deal.status !== 'withdrawn' &&
    deal.status !== 'expired' &&
    deal.status !== 'rejected' &&
    (deal.year === undefined || deal.year === g.year) &&
    g.day <= (deal.expires ?? deal.day + 14);
  const transfer = own || player.club === 'fa' ? 0 : retained ? deal!.fee : fromManwon(Number(fee));
  const cost = transfer + agentFee + amount * 0.05;
  const valid =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1e8 &&
    Number.isFinite(transfer) &&
    transfer >= 0 &&
    transfer <= 1e10;
  return {
    salary,
    setSalary,
    years,
    setYears,
    fee,
    setFee,
    amount,
    agentFee,
    retained,
    transfer,
    cost,
    valid,
  };
}
