'use client';
import { useState } from 'react';
import type { Deal, GameState, Player } from '@dugout/shared/types';
import { askPrice, fromManwon, toManwon } from '@dugout/shared/game-view';
import { useWorld } from '../career/world-context';
import { useFreeAgentQuote } from './use-free-agent-quote';
export function usePlayerOffer(player: Player, g: GameState, deal: Deal | undefined, own: boolean) {
  const { agentFor } = useWorld();
  const previous = deal?.history?.findLast((h) => h.side === 'club');
  const valuation = useFreeAgentQuote(
    !own && player.club === 'fa' ? player.id : undefined,
    g.club,
    g.year,
    g.day,
  );
  const [salaryInput, setSalary] = useState<string | null>(null),
    [yearInput, setYears] = useState<number | null>(null),
    [fee, setFee] = useState(String(toManwon(deal?.fee ?? askPrice(player))));
  const initial =
    previous?.salary ?? deal?.salary ?? (own ? player.salary * 1.1 : valuation.quote?.salary);
  const salary = salaryInput ?? (initial === undefined ? '' : String(toManwon(initial)));
  const years =
    yearInput ?? previous?.years ?? deal?.years ?? (own ? 3 : (valuation.quote?.years ?? 2));
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
    ...valuation,
  };
}
