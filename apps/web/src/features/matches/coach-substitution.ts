import type { DefensivePosition, GameState, Player } from '@dugout/shared/types';
import { firstTeam, familiarity } from '@dugout/shared/management';
import { isAvailable } from '@dugout/shared/long-term';
import { matchDecision } from '@dugout/shared/match-decision';
import { matchEnergy } from '@dugout/shared/match-energy';
import { bullpenLabels, bullpenState } from '@dugout/shared/bullpen';
import { selectReliever } from '@dugout/shared/relief-selection';
import { coachAssessment, coachJudgment } from '@dugout/shared/coach-assessment';
import { playKind } from '@dugout/shared/replay';
import { matchPlanAt, type MatchPlan } from './match-plan-state';

export type CoachSubstitution = {
  id: string;
  kind: 'pitcher' | 'batter' | 'fielder';
  coach: string;
  judgment: string;
  outgoing: Player;
  incoming: Player;
  reason: string;
  plan: MatchPlan;
  emergency: boolean;
  preparation?: string;
  canWarm: boolean;
};

/** Advice from visible own-team data and completed plays. Applying it still needs server validation. */
export function coachSubstitution(g: GameState, cursor: number): CoachSubstitution | undefined {
  const live = g.liveMatch;
  if (!live?.timeline?.replayTeams || cursor <= 0 || cursor >= live.timeline.log.length) return;
  const decision = matchDecision(live, g.club, cursor);
  const coach = g.staff.find((c) => c.role === (decision.attacking ? '타격' : '투수'));
  if (!coach) return;
  const judgment = coachJudgment(coach);
  const { plan, usedBatters, usedPitchers } = matchPlanAt(g, cursor);
  const players = firstTeam(g).filter(isAvailable);
  const byId = new Map(players.map((p) => [p.id, p]));
  const energy = matchEnergy(live.timeline, cursor);
  const condition = (p: Player) => energy.get(p.id) ?? p.condition;
  const past = live.timeline.log.slice(0, cursor);
  const own = live.home === g.club ? 1 : 0;
  const score = past.at(-1)?.score || [0, 0];
  const lead = score[own] - score[1 - own];
  const outgoing = byId.get(decision.attacking ? decision.batterId : plan.pitcher);
  if (!outgoing) return;
  let incoming: Player | undefined,
    reason = '';
  let emergency = false,
    preparation: string | undefined,
    canWarm = false;
  const next = { ...plan, lineup: [...plan.lineup], defense: { ...plan.defense } };
  // 함수 선언은 호이스팅되어 위쪽 coach 좁히기가 적용되지 않으므로 이름을 미리 고정한다.
  const coachName = coach.name;
  /**
   * 대수비 제안. 후반에 수비가 약한 야수를 더 나은 수비수로 바꾼다. 점수 상황과
   * 무관하게 검토하며, 투수 교체 사유가 없을 때만 올라오므로 한 번에 한 가지
   * 제안만 뜬다.
   */
  function fielder(): CoachSubstitution | undefined {
    if (decision.inning < 7) return;
    const fieldScore = (p: Player, pos: DefensivePosition) =>
      (p.field * 0.7 + familiarity(p, pos) * 0.3) * (0.7 + condition(p) / 333);
    const bench = players.filter(
      (p) => p.pos !== 'P' && !usedBatters.has(p.id) && condition(p) >= 65,
    );
    if (!bench.length) return;
    let best:
      { pos: DefensivePosition; slot: number; out: Player; in: Player; gain: number } | undefined;
    for (const pos of Object.keys(plan.defense) as DefensivePosition[]) {
      if (pos === 'P') continue;
      const out = byId.get(plan.defense[pos]!);
      const slot = plan.lineup.indexOf(plan.defense[pos]!);
      if (!out || slot < 0) continue;
      const candidate = bench
        .filter((p) => familiarity(p, pos) >= 65)
        .toSorted((a, b) => fieldScore(b, pos) - fieldScore(a, pos))[0];
      if (!candidate) continue;
      const gain = fieldScore(candidate, pos) - fieldScore(out, pos);
      if (gain < judgment.minimumGain) continue;
      if (!best || gain > best.gain) best = { pos, slot, out, in: candidate, gain };
    }
    if (!best) return;
    const situation = () =>
      lead > 0
        ? `${decision.inning}회 ${lead}점 리드입니다.`
        : lead === 0
          ? `${decision.inning}회 동점입니다.`
          : `${decision.inning}회 ${-lead}점 뒤지고 있습니다.`;
    const plan2 = { ...plan, lineup: [...plan.lineup], defense: { ...plan.defense } };
    plan2.lineup[best.slot] = best.in.id;
    plan2.defense[best.pos] = best.in.id;
    return {
      id: `${cursor}:${best.out.id}:${best.in.id}`,
      kind: 'fielder',
      coach: coachName,
      judgment: `능력 ${judgment.skill} · ${judgment.label}`,
      outgoing: best.out,
      incoming: best.in,
      reason: `${situation()} ${best.pos} 수비를 ${best.out.name}(수비 ${best.out.field})에서 ${best.in.name}(수비 ${best.in.field})으로 바꿔 ${lead > 0 ? '리드를 지키는' : '추가 실점을 막는'} 것을 권합니다.`,
      plan: plan2,
      emergency: false,
      canWarm: false,
    };
  }
  if (!decision.attacking) {
    if (!g.pitching) return;
    const appearances = past.filter((e) => e.half !== own && e.play?.pitcher === outgoing.id);
    const outs = appearances.reduce(
      (sum, e) => sum + Math.max(0, e.play!.after.outs - e.play!.before.outs),
      0,
    );
    const runs = appearances.reduce(
      (sum, e) => sum + e.play!.after.score[1 - own] - e.play!.before.score[1 - own],
      0,
    );
    const recentRuns = appearances
      .slice(-6)
      .reduce((sum, e) => sum + e.play!.after.score[1 - own] - e.play!.before.score[1 - own], 0);
    const closing =
      decision.inning >= 9 && lead > 0 && lead <= 3 && outgoing.id !== g.pitching.closer;
    const protectCloser = Math.abs(lead) >= 4 && outgoing.id === g.pitching.closer;
    if (condition(outgoing) <= judgment.fatigue)
      reason = `경기 체력이 ${Math.round(condition(outgoing))}%입니다. 지친 투수를 쉬게 해 주세요.`;
    else if (recentRuns >= 3 || runs >= 5)
      reason = `${runs}실점했고 최근 6타석에서 ${recentRuns}점을 내줬습니다. 불펜 교체를 권합니다.`;
    else if (protectCloser)
      reason = `${Math.abs(lead)}점 차입니다. 마무리를 아끼고 다른 계투에게 맡기겠습니다.`;
    else if (closing)
      reason = `${decision.inning}회 ${lead}점 리드입니다. 승리를 지킬 투수가 필요합니다.`;
    else if (outs >= 18)
      reason = `${Math.floor(outs / 3)}이닝을 소화했습니다. 다음 승부는 불펜에 맡기는 것을 권합니다.`;
    else return fielder();
    const candidates = players.filter((p) => p.pos === 'P' && condition(p) >= 55);
    const ranked = candidates.toSorted(
      (a, b) =>
        coachAssessment(coach, b, true) +
        condition(b) * 0.25 -
        coachAssessment(coach, a, true) -
        condition(a) * 0.25,
    );
    const rankGroup = (ids: string[]) => ranked.filter((p) => ids.includes(p.id)).map((p) => p.id);
    const choose = (roster: Player[]) =>
      selectReliever({
        plan: {
          ...g.pitching!,
          bullpen: rankGroup(g.pitching!.bullpen),
          setup: rankGroup(g.pitching!.setup || []),
          chase: rankGroup(g.pitching!.chase || []),
        },
        roster,
        used: usedPitchers,
        inning: decision.inning,
        lead,
      });
    const ready = candidates.filter(
      (p) => !live.bullpenVersion || bullpenState(live, p.id, cursor).status === 'ready',
    );
    incoming = choose(ready) || choose(candidates);
    if (!incoming) return;
    const warm = bullpenState(live, incoming.id, cursor);
    emergency = !!live.bullpenVersion && warm.status !== 'ready';
    preparation = live.bullpenVersion ? bullpenLabels[warm.status] : undefined;
    canWarm =
      !!live.bullpenVersion &&
      warm.status === 'standby' &&
      players.filter(
        (p) =>
          p.pos === 'P' &&
          !usedPitchers.has(p.id) &&
          bullpenState(live, p.id, cursor).status !== 'standby',
      ).length < 2;
    next.pitcher = incoming.id;
    next.defense.P = incoming.id;
  } else {
    if (decision.inning < 6) return;
    const position = (Object.keys(plan.defense) as DefensivePosition[]).find(
      (p) => plan.defense[p] === outgoing.id,
    );
    if (!position) return;
    const battingScore = (p: Player) =>
      coachAssessment(coach, p, false) * (0.5 + condition(p) / 200);
    incoming = players
      .filter(
        (p) =>
          p.pos !== 'P' &&
          !usedBatters.has(p.id) &&
          condition(p) >= 65 &&
          familiarity(p, position) >= 65,
      )
      .toSorted((a, b) => battingScore(b) - battingScore(a))[0];
    if (!incoming) return;
    const gain = battingScore(incoming) - battingScore(outgoing);
    const atBats = past.filter(
      (e) =>
        e.half === own &&
        e.play?.batter === outgoing.id &&
        e.play.plateAppearance !== false &&
        !['walk', 'sacrifice'].includes(playKind(e.text)),
    );
    const hits = atBats.filter((e) =>
      ['single', 'double', 'triple', 'homeRun'].includes(playKind(e.text)),
    ).length;
    const today = atBats.length ? `오늘 ${atBats.length}타수 ${hits}안타입니다. ` : '';
    const season = outgoing.stats.ab >= 20 ? outgoing.stats.h / outgoing.stats.ab : undefined;
    if (condition(outgoing) <= judgment.fatigue && gain >= judgment.minimumGain * 0.6)
      reason = `경기 체력이 ${Math.round(condition(outgoing))}%입니다. 같은 수비 위치를 맡을 수 있는 대타를 권합니다.`;
    else if (
      decision.kind === 'opportunity' &&
      decision.inning >= 7 &&
      gain >= judgment.minimumGain
    )
      reason = `${today}득점 기회에 타격 기대치가 더 높은 대타를 권합니다.`;
    // 상황과 무관한 타격 부진도 교체 사유로 본다. 기회 상황만 보면 계속 못 치는
    // 선수가 경기 끝까지 타순에 남는다.
    else if (atBats.length >= 3 && hits === 0 && gain >= judgment.minimumGain)
      reason = `${today}타격이 맞지 않습니다. 남은 타석은 대타에게 맡기는 것을 권합니다.`;
    else if (season !== undefined && season < 0.24 && gain >= judgment.minimumGain)
      reason = `${today}시즌 타율 ${season.toFixed(3)}로 타격이 풀리지 않았습니다. 대타를 권합니다.`;
    else return fielder();
    next.lineup[decision.slot] = incoming.id;
    next.defense[position] = incoming.id;
  }
  return {
    id: `${cursor}:${outgoing.id}:${incoming.id}`,
    kind: decision.attacking ? 'batter' : 'pitcher',
    coach: coach.name,
    judgment: `능력 ${judgment.skill} · ${judgment.label}`,
    outgoing,
    incoming,
    reason,
    plan: next,
    emergency,
    preparation,
    canWarm,
  };
}
