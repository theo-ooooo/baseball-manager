'use client';
import { isAvailable } from '@dugout/shared/long-term';
import { useState } from 'react';
import type { Defense, GameState, TeamInstructions } from '@dugout/shared/types';
import { firstTeam, autoDefense } from '@dugout/shared/management';
import { lineupAuto } from '@dugout/shared/game-view';
import { starterScore } from '@dugout/shared/pitching';
import { matchEnergy } from '@dugout/shared/match-energy';
import { nextMatchHalf } from '@dugout/shared/match-commands';
import { matchDecision } from '@dugout/shared/match-decision';
import { matchPlanAt, type MatchPlan } from './match-plan-state';
export type { MatchPlan } from './match-plan-state';

export type PlanSlot = number | 'P';
const equal = (a: MatchPlan, b: MatchPlan) => JSON.stringify(a) === JSON.stringify(b);

// Draft interactions never simulate or save a game. The server validates the submitted plan.
export function useMatchPlan(g: GameState, cursor: number, busy: boolean) {
  const live = g.liveMatch!,
    timeline = live.timeline!;
  const side = live.home === g.club ? 1 : 0;
  const { plan: initial, usedBatters, usedPitchers } = matchPlanAt(g, cursor);
  const [history, setHistory] = useState<MatchPlan[]>([initial]);
  const decision = matchDecision(live, g.club, cursor);
  const [target, setTarget] = useState<PlanSlot | null>(
    cursor > 0 && decision.attacking ? decision.slot : null,
  );
  const [incoming, setIncoming] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const plan = history.at(-1)!;
  const players = firstTeam(g).filter(isAvailable),
    byId = new Map(players.map((p) => [p.id, p]));
  const canPitch = cursor === 0 || nextMatchHalf(live, cursor) !== side;
  function commit(next: MatchPlan) {
    if (!equal(plan, next)) setHistory((past) => [...past.slice(-29), next]);
  }
  function unavailable(id: string) {
    const p = byId.get(id);
    if (!p) return '1군 선수만 투입할 수 있습니다.';
    if (p.pos === 'P') {
      if (!canPitch) return '우리 팀 수비 타석 직전에 교체할 수 있습니다.';
      if (cursor > 0 && usedPitchers.has(id) && id !== initial.pitcher) return '이미 등판한 투수';
    } else if (cursor > 0 && usedBatters.has(id) && !initial.lineup.includes(id))
      return '교체 아웃 · 재출전 불가';
    // A drafted-out starter cannot re-enter a different slot during the game; undo restores it.
    if (cursor > 0 && p.pos !== 'P' && usedBatters.has(id) && !plan.lineup.includes(id))
      return '출전 선수 · 되돌리기로 복원';
    return '';
  }
  function assign(slot: PlanSlot, id: string, reorder = false) {
    if (busy) return;
    const p = byId.get(id),
      old = slot === 'P' ? plan.pitcher : plan.lineup[slot];
    if (!p || old === id) return;
    const reason = unavailable(id);
    if (reason) {
      setNotice(reason);
      return;
    }
    if ((slot === 'P') !== (p.pos === 'P')) {
      setNotice(slot === 'P' ? '불펜에서 투수를 골라 주세요.' : '벤치에서 야수를 골라 주세요.');
      return;
    }
    const lineup = [...plan.lineup],
      other = lineup.indexOf(id);
    if (slot !== 'P' && other >= 0) {
      if (cursor > 0 || !reorder) {
        setNotice(
          cursor > 0
            ? '경기 중에는 타순을 바꿀 수 없습니다.'
            : '타순은 오른쪽 타순표에서 바꿔 주세요.',
        );
        return;
      }
      lineup[other] = old;
    }
    if (slot !== 'P') lineup[slot] = id;
    const defense = { ...plan.defense };
    if (other < 0)
      for (const pos of Object.keys(defense) as (keyof Defense)[]) {
        if (defense[pos] === old) defense[pos] = id;
      }
    commit({ ...plan, lineup, defense, pitcher: slot === 'P' ? id : plan.pitcher });
    setNotice(
      other >= 0
        ? `${byId.get(old)?.name} · ${p.name} 타순 교환`
        : `${byId.get(old)?.name} → ${p.name} 교체 대기`,
    );
    setTarget(null);
    setIncoming(null);
  }
  function chooseSlot(slot: PlanSlot) {
    if (incoming) assign(slot, incoming);
    else {
      setTarget(target === slot ? null : slot);
      setNotice('');
    }
  }
  function chooseBench(id: string) {
    if (target !== null) assign(target, id);
    else {
      setIncoming(incoming === id ? null : id);
      setNotice('교체할 선수를 구장이나 타순표에서 눌러 주세요.');
    }
  }
  function restore() {
    setHistory((past) => past.slice(0, Math.max(1, past.length - 1)));
    setTarget(null);
    setIncoming(null);
    setNotice('마지막 변경을 되돌렸습니다.');
  }
  return {
    plan,
    initial,
    defense: plan.defense,
    players,
    energy: matchEnergy(timeline, cursor),
    byId,
    target,
    incoming,
    notice,
    canPitch,
    decision,
    dirty: !equal(plan, initial),
    canUndo: history.length > 1,
    unavailable,
    assign,
    chooseSlot,
    chooseBench,
    restore,
    recommend: (pitchersOnly = false) => {
      if (cursor > 0 || busy) return;
      if (pitchersOnly) {
        const candidates = players.filter((p) => g.pitching?.rotation.includes(p.id));
        const pitcher = candidates.toSorted(
          (a, b) => starterScore(b) * b.condition - starterScore(a) * a.condition,
        )[0];
        if (pitcher)
          commit({ ...plan, pitcher: pitcher.id, defense: { ...plan.defense, P: pitcher.id } });
        setNotice('코치가 선발 보직·컨디션·기록을 보고 추천했습니다. 적용 전 확인하세요.');
      } else {
        const lineup = lineupAuto(players);
        const defense = autoDefense({ ...g, lineup, starter: plan.pitcher, defense: undefined });
        commit({ ...plan, lineup, defense });
        setNotice('코치가 컨디션·능력·포지션 균형을 고려해 야수 9명과 타순을 추천했습니다.');
      }
    },
    setInstructions: (instructions: TeamInstructions) => commit({ ...plan, instructions }),
  };
}
export type MatchPlanDraft = ReturnType<typeof useMatchPlan>;
