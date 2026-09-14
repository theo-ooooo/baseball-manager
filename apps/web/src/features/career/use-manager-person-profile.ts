'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { coachDirectory } from '@dugout/shared/coach-directory';
import { managerCoachingStance } from '@dugout/shared/personality';
import { managerDirectory } from '@dugout/shared/manager-directory';
import {
  managerAbility,
  managerAbilityOverall,
  selfManagerAbility,
  managerAbilityKeys,
} from '@dugout/shared/manager-ability';
import { departureLabel } from '@dugout/shared/manager-departure';
import { useWorld } from './world-context';
export function useManagerPersonProfile(g: GameState, id: string) {
  const [tab, setTab] = useState('overview');
  const [offering, setOffering] = useState(false);
  const { getClub, standings, coachPool } = useWorld();
  const person = managerDirectory(g).find((p) => p.id === id || p.record?.aliases?.includes(id));
  // 예전 저장본에는 능력치가 없으므로 기록에서 그때그때 채워 읽는다. 내 감독은 기록이
  // 아니라 현재 평판에서 계산하므로 성적이 쌓이면 값이 따라 오른다.
  const ability = person?.self
    ? selfManagerAbility(g)
    : person?.record
      ? managerAbility(person.record)
      : undefined;
  const job = person?.job,
    club = person?.club;
  const table = club ? standings(g, getClub(club).league) : [];
  const row = table.find((r) => r.club === club);
  const wins = row && job ? Math.max(0, row.w - job.startWins) : 0;
  const losses = row && job ? Math.max(0, row.l - job.startLosses) : 0;
  const draws = row && job ? Math.max(0, row.d - (job.startDraws || 0)) : 0;
  const background = person?.self ? g.managerCareer?.background : person?.record?.background;
  const career = person?.self
    ? [
        ...(club && job
          ? [
              {
                club,
                from: job.appointed,
                to: undefined,
                role: '감독',
                active: true,
                detail: `${wins}승 ${losses}패 ${draws}무 · 이번 시즌 취임 후`,
              },
            ]
          : []),
        ...(g.managerCareer?.history || []).map((h) => ({
          club: h.club,
          from: h.from,
          to: h.to,
          role: '감독',
          active: false,
          detail: `${departureLabel(h)} · 퇴임 당시 ${h.rank}위${h.detail ? ` · ${h.detail}` : ''}`,
        })),
      ]
    : (person?.record?.career || []).map((h) => ({
        club: h.club,
        from: h.from,
        to: h.to,
        role: h.role || '감독',
        active: h.active,
        detail: [
          h.wins !== undefined ? `${h.wins}승 ${h.losses || 0}패 · 기록된 재임 성적` : '',
          h.reason,
        ]
          .filter(Boolean)
          .join(' · '),
      }));
  career.sort(
    (a, b) => Number(b.active) - Number(a.active) || (b.from || '').localeCompare(a.from || ''),
  );
  const strongest =
    ability && managerAbilityKeys.reduce((a, b) => (ability[b] > ability[a] ? b : a));
  return {
    tab,
    setTab,
    offering,
    setOffering,
    coach: person?.record
      ? coachDirectory(g, coachPool(g.year)).find((e) => e.coach.id === person.id)?.coach
      : undefined,
    stance: person?.record ? managerCoachingStance(person.record) : undefined,
    person,
    ability,
    abilityOverall: ability && managerAbilityOverall(ability),
    strongest,
    background,
    career,
    draws,
    winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : undefined,
    getClub,
    wins,
    losses,
    rank:
      row && row.w + row.l + row.d > 0 ? table.findIndex((r) => r.club === club) + 1 : undefined,
    contract: person?.self ? g.managerCareer?.contract : undefined,
    reputation: person?.self
      ? (g.managerCareer?.reputation ?? g.reputation)
      : person?.record?.reputation,
  };
}
