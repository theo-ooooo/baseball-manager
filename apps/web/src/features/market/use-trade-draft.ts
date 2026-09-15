'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import type { TradeOffer } from '@dugout/shared/long-term';
import type { TradeSuggestion } from '@dugout/shared/trade-recommendations';
import { fromManwon, toManwon } from '@dugout/shared/game-view';
import { isActiveTrade, tradeNeedsConfirmation, tradeCanRevise } from '@dugout/shared/trade-status';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
export function useTradeDraft(g: GameState, targetId: string | undefined, act: Act, busy: boolean) {
  const { clubs, getClub, marketPlayers, rosterFor } = useWorld();
  const others = clubs.filter((c) => c.id !== g.club && c.league === getClub(g.club).league);
  const target = targetId
    ? marketPlayers(g).find((p) => p.id === targetId && others.some((c) => c.id === p.club))
    : undefined;
  const [tab, setTab] = useState('active');
  const [open, setOpen] = useState(!!target),
    [editing, setEditing] = useState<string>();
  const offer = g.trades?.find((o) => o.id === editing);
  const [club, setClub] = useState(target?.club || others[0]?.id || '');
  const [incoming, setIncoming] = useState<string[]>(target ? [target.id] : []);
  const [outgoing, setOutgoing] = useState<string[]>([]);
  const [cash, setCash] = useState('0'),
    [direction, setDirection] = useState('pay');
  const [ownQuery, setOwnQuery] = useState(''),
    [otherQuery, setOtherQuery] = useState('');
  const active = (g.trades || [])
    .filter((o) => isActiveTrade(g, o))
    .sort(
      (a, b) =>
        Number(tradeNeedsConfirmation(g, b)) - Number(tradeNeedsConfirmation(g, a)) ||
        a.expires.localeCompare(b.expires),
    );
  const past = (g.trades || []).filter((o) => !isActiveTrade(g, o));
  const reserved = new Set(
    active
      .filter((o) => o.id !== editing)
      .flatMap((o) => [
        ...o.outgoing,
        ...o.incoming,
        ...(o.counterOutgoing || []),
        ...(o.counterIncoming || []),
      ]),
  );
  const amount = fromManwon(Number(cash)) * (direction === 'pay' ? 1 : -1);
  const otherRoster = club ? rosterFor(g, club) : [];
  const invalid = !!editing && (!offer || !tradeCanRevise(g, offer));
  const submit = async () => {
    if (
      busy ||
      invalid ||
      g.liveMatch ||
      !incoming.length ||
      !outgoing.length ||
      !Number.isFinite(amount) ||
      Number(cash) < 0
    )
      return;
    if (
      await act(
        offer
          ? { type: 'reviseTrade', id: offer.id, outgoing, incoming, cash: amount }
          : { type: 'proposeTrade', club, outgoing, incoming, cash: amount },
      )
    ) {
      setOpen(false);
      setEditing(undefined);
      setOutgoing([]);
      setIncoming([]);
      setCash('0');
      setTab('active');
    }
  };
  return {
    open,
    setOpen(value: boolean) {
      setOpen(value);
      if (!value) setEditing(undefined);
    },
    invalid,
    offer,
    startNew() {
      setEditing(undefined);
      setOutgoing([]);
      setIncoming([]);
      setCash('0');
      setDirection('pay');
      setOwnQuery('');
      setOtherQuery('');
      setOpen(true);
    },
    revise(o: TradeOffer) {
      setEditing(o.id);
      setClub(o.club);
      setIncoming(o.counterIncoming || o.incoming);
      setOutgoing(o.counterOutgoing || o.outgoing);
      const money = o.counterCash ?? o.cash;
      setCash(String(toManwon(Math.abs(money))));
      setDirection(money < 0 ? 'receive' : 'pay');
      setOwnQuery('');
      setOtherQuery('');
      setOpen(true);
    },
    applySuggestion(s: TradeSuggestion) {
      setClub(s.club);
      setIncoming(s.incoming.map((p) => p.id));
      setOutgoing(s.outgoing.map((p) => p.id));
      setCash(String(toManwon(Math.abs(s.cash))));
      setDirection(s.cash < 0 ? 'receive' : 'pay');
      setOwnQuery('');
      setOtherQuery('');
      setOpen(true);
    },
    others,
    club,
    setClub,
    incoming,
    setIncoming,
    outgoing,
    setOutgoing,
    cash,
    setCash,
    direction,
    setDirection,
    amount,
    tab,
    setTab,
    ownQuery,
    setOwnQuery,
    otherQuery,
    setOtherQuery,
    active,
    past,
    reserved,
    otherRoster,
    submit,
    selectedOutgoing: g.roster.filter((p) => outgoing.includes(p.id)),
    selectedIncoming: otherRoster.filter((p) => incoming.includes(p.id)),
  };
}
