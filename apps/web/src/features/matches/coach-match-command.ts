import { abilityText } from '@dugout/shared/ratings';
import type { GameState } from '@dugout/shared/types';
import { hash } from '@dugout/shared/game-view';
import { coachJudgment } from '@dugout/shared/coach-assessment';
import { matchDecision } from '@dugout/shared/match-decision';
import { matchEnergy } from '@dugout/shared/match-energy';
import { matchCommandOptions } from '@dugout/shared/match-commands';
import { coachBattingCommand } from './coach-batting-command';

/** Advice reads own-player abilities and consumed plays; it never inspects the next outcome. */
export function coachMatchCommand(g: GameState, cursor: number) {
  const live = g.liveMatch;
  if (!live?.timeline || live.finished || cursor < live.cursor) return;
  const decision = matchDecision(live, g.club, cursor);
  if (decision.finished) return;
  const player = g.roster.find(
    (p) => p.id === (decision.attacking ? decision.batterId : decision.pitcherId),
  );
  if (!player) return;
  const energy = Math.round(matchEnergy(live.timeline, cursor).get(player.id) ?? player.condition);
  if (decision.attacking) {
    const advice = coachBattingCommand(g, cursor);
    return (
      advice && {
        ...advice,
        role: '타격',
        player: player.name,
        profile: `컨택 ${abilityText(player.contact)} · 장타 ${abilityText(player.power)} · 경기 체력 ${energy}%`,
      }
    );
  }
  const coach = g.staff.find((c) => c.role === '투수');
  if (!coach) return;
  const judgment = coachJudgment(coach);
  const runners = decision.bases.filter(Boolean).length;
  const doublePlay = !!decision.bases[0] && decision.outs < 2;
  const loaded = runners === 3;
  const candidates = {
    attackBatter: {
      score: 58 + player.control * 0.2 + (loaded ? 30 : 0) + (player.control < 55 ? 15 : 0),
      reason: `${player.name}에게 스트라이크 승부를 권합니다. ${loaded ? '만루라 볼넷이 바로 실점으로 이어집니다.' : player.control < 55 ? '제구가 낮아 유인구를 남발하면 볼넷 위험이 큽니다.' : `제구 ${abilityText(player.control)}를 살려 불리한 볼카운트를 줄입니다.`} 가운데 몰리는 공과 장타에는 주의해야 합니다.`,
    },
    pitchAround: {
      score:
        40 +
        player.stuff * 0.6 +
        (decision.outs === 2 ? 10 : 0) -
        (100 - player.control) * 0.25 -
        (runners ? 10 : 0) -
        (energy < 55 ? 20 : 0) -
        (loaded ? 35 : 0),
      reason: `${player.name}의 구위 ${abilityText(player.stuff)}·제구 ${abilityText(player.control)}를 살려 유인구로 헛스윙을 노립니다.${decision.outs === 2 ? ' 아웃 하나면 이닝을 끝낼 수 있습니다.' : ''} 볼넷과 추가 체력 소모를 감수하는 선택입니다.`,
    },
    induceGrounder: {
      score:
        40 +
        player.control * 0.3 +
        (doublePlay ? 30 : 0) +
        (decision.bases[2] && decision.outs < 2 ? 8 : 0),
      reason: `${player.name}의 제구 ${abilityText(player.control)}로 낮게 승부합니다. ${doublePlay ? `${decision.outs}사 1루 주자가 있어 병살을 노릴 수 있습니다.` : '높은 공과 장타를 줄이는 쪽을 권합니다.'} 타구가 수비 사이로 빠지면 안타가 될 수 있습니다.`,
    },
  };
  const choices = matchCommandOptions(live, g.club, cursor)
    .filter((option) => !option.reason && option.kind in candidates)
    .map((option) => {
      const candidate = candidates[option.kind as keyof typeof candidates];
      const bias =
        ((hash(`${coach.id}:${live.playbackId}:${cursor}:${option.kind}`) % 2001) / 1000 - 1) *
        (100 - judgment.skill) *
        0.18;
      return { ...option, reason: candidate.reason, score: candidate.score + bias };
    })
    .sort((a, b) => b.score - a.score);
  const choice = choices[0];
  return (
    choice && {
      coach: coach.name,
      judgment: `능력 ${judgment.skill} · ${judgment.label}`,
      role: '투수',
      player: player.name,
      profile: `구위 ${abilityText(player.stuff)} · 제구 ${abilityText(player.control)} · 경기 체력 ${energy}%`,
      command: choice.kind,
      label: choice.label,
      reason: choice.reason,
    }
  );
}
