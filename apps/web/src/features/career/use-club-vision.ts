'use client';
import { useState } from 'react';
import type { GameState } from '@dugout/shared/types';
import { boardProgress } from '@dugout/shared/manager-career';
import { gameDate } from '@dugout/shared/calendar';
import { useWorld } from './world-context';
import type { Act } from './game-contracts';
export function useClubVision(g: GameState, act: Act, busy: boolean) {
  const { clubs, getClub, standings } = useWorld(),
    club = getClub(g.club),
    contract = g.managerCareer!.contract!;
  const [tab, setTab] = useState<'overview' | 'requests'>('overview'),
    [meeting, setMeeting] = useState<'target' | 'support' | null>(null),
    [target, setTarget] = useState(contract.targetRank),
    [objective, setObjective] = useState('youth'),
    [benefit, setBenefit] = useState('training');
  const row = standings(g).find((s) => s.club === g.club)!,
    rank = standings(g).findIndex((s) => s.club === g.club) + 1,
    played = row.w + row.l + row.d;
  const confidence = g.managerJobs?.[g.club]?.confidence ?? 65,
    grade =
      confidence >= 90
        ? 'A+'
        : confidence >= 80
          ? 'A'
          : confidence >= 70
            ? 'B+'
            : confidence >= 60
              ? 'B'
              : confidence >= 45
                ? 'C'
                : confidence >= 30
                  ? 'D'
                  : 'F';
  const max = Math.ceil(clubs.filter((c) => c.league === club.league).length * 0.75),
    canNegotiate =
      !g.liveMatch &&
      !g.managerCareer?.vacationUntil &&
      (g.day < 0 || contract.signed === gameDate(g));
  const progress = contract.objective ? boardProgress(g, contract.objective) : 0,
    profit = g.income - g.expenses;
  const expectation =
    played < 5
      ? '평가 중'
      : rank === 1
        ? '선두 경쟁력'
        : rank < contract.targetRank
          ? '목표보다 앞섬'
          : rank === contract.targetRank
            ? '목표권 유지 필요'
            : '개선 필요';
  const oldFeedback =
    played === 0
      ? '새 시즌의 출발을 기대하고 있습니다. 합의한 목표를 향해 선수단을 준비해 주십시오.'
      : confidence >= 60
        ? '감독의 운영 방향을 지지합니다. 합의한 시즌 목표를 향해 집중해 주십시오.'
        : '최근 성적과 운영 방향에 우려가 있습니다. 이사회에 약속한 목표를 달성할 수 있도록 개선이 필요합니다.';
  const board = g.managerJobs?.[g.club]?.board;
  const feedback = played < 5 ? oldFeedback : g.managerJobs?.[g.club]?.reason || oldFeedback;
  async function submit() {
    if (busy || !canNegotiate) return;
    if (
      await act(
        meeting === 'target'
          ? { type: 'managerTarget', targetRank: target }
          : { type: 'boardNegotiate', objective, benefit, targetRank: target },
      )
    )
      setMeeting(null);
  }
  return {
    club,
    contract,
    tab,
    setTab,
    meeting,
    setMeeting,
    target,
    setTarget,
    objective,
    setObjective,
    benefit,
    setBenefit,
    rank,
    played,
    confidence,
    grade,
    max,
    canNegotiate,
    progress,
    profit,
    expectation,
    feedback,
    board,
    submit,
  };
}
