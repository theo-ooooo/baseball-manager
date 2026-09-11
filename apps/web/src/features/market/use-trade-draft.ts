'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { fromManwon } from '@dugout/shared/game-view';
import { isActiveTrade, tradeNeedsConfirmation } from '@dugout/shared/trade-status';
import { useWorld } from '../career/world-context';
import type { Act } from '../career/game-contracts';
export function useTradeDraft(g: GameState, targetId: string | undefined, act: Act, busy: boolean) {
  const { clubs, getClub, marketPlayers, rosterFor } = useWorld();
  const others = clubs.filter((c) => c.id !== g.club && c.league === getClub(g.club).league);
  const target = targetId
    ? marketPlayers(g).find((p) => p.id === targetId && others.some((c) => c.id === p.club))
    : undefined;
  const [tab, setTab] = useState(target ? 'compose' : 'active');
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
    active.flatMap((o) => [
      ...o.outgoing,
      ...o.incoming,
      ...(o.counterOutgoing || []),
      ...(o.counterIncoming || []),
    ]),
  );
  const amount = fromManwon(Number(cash)) * (direction === 'pay' ? 1 : -1);
  const otherRoster = club ? rosterFor(g, club) : [];
  const submit = async () => {
    if (
      busy ||
      g.liveMatch ||
      !incoming.length ||
      !outgoing.length ||
      !Number.isFinite(amount) ||
      Number(cash) < 0
    )
      return;
    if (await act({ type: 'proposeTrade', club, outgoing, incoming, cash: amount })) {
      setOutgoing([]);
      setIncoming([]);
      setCash('0');
      setTab('active');
    }
  };
  return {
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
