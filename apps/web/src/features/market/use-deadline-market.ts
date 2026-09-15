'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import {
  deadlineCountdown,
  deadlineOffer,
  type DeadlineListing,
} from '@dugout/shared/deadline-market';
import { fromManwon, toManwon } from '@dugout/shared/game-view';
import { gameDate } from '@dugout/shared/calendar';
import type { Act } from '../career/game-contracts';
import { useWorld } from '../career/world-context';
export function useDeadlineMarket(g: GameState, act: Act, busy: boolean) {
  const world = useWorld(),
    window = deadlineCountdown(g, world.getClub(g.club).league);
  const [opened, setOpened] = useState<string>(),
    [outgoing, setOutgoing] = useState<string[]>([]),
    [cash, setCash] = useState('0'),
    [query, setQuery] = useState('');
  const listings =
    g.deadlineMarket?.club === g.club && g.deadlineMarket.year === g.year
      ? g.deadlineMarket.listings
      : [];
  const listing = listings.find((l) => l.id === opened),
    offer = listing ? deadlineOffer(g, listing) : undefined;
  const locked =
    busy ||
    !!g.liveMatch ||
    !!g.managerCareer?.vacationUntil ||
    window.closed ||
    g.managerCareer?.status !== 'employed';
  const amount = fromManwon(Number(cash));
  const reserved = new Set(
    (g.trades || [])
      .filter((o) => o.id !== offer?.id && ['pending', 'accepted', 'counter'].includes(o.status))
      .flatMap((o) => [...o.outgoing, ...(o.counterOutgoing || [])]),
  );
  const selectable = !!listing && listing.status === 'open' && gameDate(g) < listing.closes;
  return {
    window,
    listings,
    listing,
    offer,
    outgoing,
    setOutgoing,
    cash,
    setCash,
    query,
    setQuery,
    reserved,
    locked,
    amount,
    open: !!listing && selectable,
    ready:
      selectable &&
      !locked &&
      outgoing.length >= 1 &&
      outgoing.length <= 3 &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      amount <= g.budget,
    applySuggestion(s: import('@dugout/shared/trade-recommendations').TradeSuggestion) {
      setOutgoing(s.outgoing.map((p) => p.id));
      setCash(String(toManwon(s.cash)));
    },
    candidates: g.roster.filter((p) => `${p.name} ${p.pos}`.includes(query.trim())),
    show(l: DeadlineListing) {
      const previous = deadlineOffer(g, l);
      setOpened(l.id);
      setOutgoing(previous?.counterOutgoing || previous?.outgoing || []);
      setCash(String(toManwon(previous?.counterCash ?? previous?.cash ?? 0)));
      setQuery('');
    },
    setOpen(value: boolean) {
      if (!value) setOpened(undefined);
    },
    async submit() {
      if (
        !listing ||
        !selectable ||
        locked ||
        !outgoing.length ||
        outgoing.length > 3 ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > g.budget
      )
        return;
      const next = await act(
        offer
          ? { type: 'reviseDeadlineTrade', id: offer.id, outgoing, cash: amount }
          : {
              type: 'proposeTrade',
              club: listing.seller,
              incoming: [listing.player.id],
              outgoing,
              cash: amount,
              deadlineId: listing.id,
            },
      );
      if (next) setOpened(undefined);
    },
  };
}
