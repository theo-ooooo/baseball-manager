import type { GameState } from '@dugout/shared/types';
import { hash } from '@dugout/shared/game-view';
import { coachJudgment } from '@dugout/shared/coach-assessment';
import { matchDecision } from '@dugout/shared/match-decision';
import { matchEnergy } from '@dugout/shared/match-energy';
import {
  isPitchingCommand,
  matchCommandOptions,
  type MatchCommandKind,
} from '@dugout/shared/match-commands';

/** Coaching advice uses the next lineup slot and watched plays, never an unreplayed outcome. */
export function coachBattingCommand(g: GameState, cursor: number) {
  const live = g.liveMatch,
    coach = g.staff.find((c) => c.role === '타격');
  if (!live?.timeline || !coach || live.finished || cursor < live.cursor) return;
  const decision = matchDecision(live, g.club, cursor);
  if (!decision.attacking || decision.finished) return;
  const batter = g.roster.find((p) => p.id === decision.batterId);
  if (!batter) return;
  const judgment = coachJudgment(coach);
  const own = live.home === g.club ? 1 : 0;
  const score = live.timeline.log[cursor - 1]?.score || [0, 0];
  const lead = score[own] - score[1 - own];
  const late = decision.inning >= 7;
  const runners = decision.bases.filter(Boolean).length;
  const energy = matchEnergy(live.timeline, cursor);
  const runner = (base: number) => g.roster.find((p) => p.id === decision.bases[base]);
  const speed = (base: number) => {
    const p = runner(base);
    return p ? p.speed * (0.5 + (energy.get(p.id) ?? p.condition) / 200) : 0;
  };
  const candidates: Record<
    Exclude<
      MatchCommandKind,
      'attackBatter' | 'pitchAround' | 'induceGrounder' | 'intentionalWalk'
    >,
    { score: number; reason: string }
  > = {
    contactFocus: {
      score:
        55 +
        (runners ? 12 : 0) +
        (decision.bases[2] && decision.outs < 2 ? 15 : 0) +
        batter.contact * 0.12,
      reason: `${batter.name}에게 인플레이 타구를 주문합니다.${runners ? ` ${decision.outs}사에 주자 ${runners}명이라 삼진을 줄이는 쪽을 권합니다.` : ' 삼진 위험을 줄이고 출루 기회를 만들겠습니다.'}`,
    },
    swingAway: {
      score:
        28 +
        batter.power * 0.5 +
        (late && lead < -1 ? 18 : 0) -
        (runners && decision.outs < 2 ? 8 : 0),
      reason: `${batter.name}의 장타력 ${Math.round(batter.power)}를 살리는 승부입니다.${late && lead < 0 ? ` ${-lead}점 뒤진 후반이라 큰 타구를 노립니다.` : ' 장타를 노리는 대신 삼진 위험을 감수합니다.'}`,
    },
    workCount: {
      score:
        60 +
        (!runners ? 8 : 0) +
        (late && lead < 0 ? 6 : 0) -
        (decision.bases[2] && decision.outs < 2 ? 18 : 0),
      reason: `${runners ? '주자를 더 모으기 위해' : '먼저 출루하기 위해'} 공을 지켜보며 볼넷을 노립니다. 루킹 삼진 위험도 있습니다.`,
    },
    bunt: {
      score:
        30 +
        (late && Math.abs(lead) <= 1 ? 40 : 0) +
        (decision.outs === 0 ? 12 : -15) -
        batter.power * 0.15,
      reason: `${decision.inning}회 ${decision.outs}사입니다. 아웃 하나를 내주고 주자를 전진시켜 한 점을 노립니다. 번트 실패 위험이 있습니다.`,
    },
    hitAndRun: {
      score: 12 + batter.contact * 0.55 + speed(0) * 0.2 - (decision.outs === 1 ? 4 : 0),
      reason: `컨택 ${Math.round(batter.contact)}인 ${batter.name}에게 맞히는 타격을 주문하고 1루 주자를 출발시킵니다. 헛스윙 시 도루사 위험이 있습니다.`,
    },
    stealSecond: {
      score: speed(0) - 12 - (late && lead < -1 ? 25 : 0),
      reason: `${runner(0)?.name || '1루 주자'}의 스피드와 현재 체력을 보고 2루 도루를 권합니다. 상대 배터리에 따라 실패할 수 있습니다.`,
    },
    stealThird: {
      score: speed(1) - 35 - (decision.outs === 2 ? 30 : 0),
      reason: `${runner(1)?.name || '2루 주자'}를 3루로 보내 한 점을 노립니다. 2루 도루보다 실패 위험이 높습니다.`,
    },
  };
  const options = matchCommandOptions(live, g.club, cursor).filter(
    (o) => !o.reason && !isPitchingCommand(o.kind),
  );
  const ranked = options
    .map((option) => {
      const candidate = candidates[option.kind as keyof typeof candidates];
      const bias =
        ((hash(`${coach.id}:${live.playbackId}:${cursor}:${option.kind}`) % 2001) / 1000 - 1) *
        (100 - judgment.skill) *
        0.18;
      return { ...option, reason: candidate.reason, score: candidate.score + bias };
    })
    .sort((a, b) => b.score - a.score);
  const choice = ranked[0];
  return choice
    ? {
        coach: coach.name,
        judgment: `능력 ${judgment.skill} · ${judgment.label}`,
        command: choice.kind,
        label: choice.label,
        reason: choice.reason,
      }
    : undefined;
}
