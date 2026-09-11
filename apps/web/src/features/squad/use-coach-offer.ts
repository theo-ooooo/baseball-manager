'use client';
import { useState } from 'react';
import type { Coach, GameState } from '@dugout/shared/types';
import { fromManwon, toManwon } from '@dugout/shared/game-view';
export function useCoachOffer(g: GameState, coach: Coach, initialRole: string) {
  const previous = g.coachDeals?.find(
    (d) =>
      d.coach.id === coach.id &&
      ['pending', 'counter', 'accepted'].includes(d.status) &&
      (d.year === undefined || d.year === g.year) &&
      g.day <= (d.expires ?? d.day + 14),
  );
  const [role, setRole] = useState(
    previous?.role || (coach.real || coach.managerPersonId ? initialRole : coach.role),
  );
  const [salary, setSalary] = useState(String(toManwon(previous?.salary || coach.salary * 1.1)));
  const [years, setYears] = useState(previous?.years || 2);
  const amount = fromManwon(Number(salary));
  const outgoing = g.staff.find((c) => c.role === role);
  const compensation = outgoing?.contractUntil
    ? outgoing.salary * Math.max(0, outgoing.contractUntil - g.year) * 0.25
    : 0;
  return {
    previous,
    role,
    setRole,
    salary,
    setSalary,
    years,
    setYears,
    amount,
    outgoing,
    compensation,
  };
}
