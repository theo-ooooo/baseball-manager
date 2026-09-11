import type { GameState, Player } from '@dugout/shared/types';
import { isAvailable } from '@dugout/shared/long-term';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { hash, lineupAuto } from '@dugout/shared/game-view';
import { firstTeam, defenseFor } from '@dugout/shared/management';
import { preparePitching } from '@dugout/shared/pitching';
import { postNews } from './club-dynamics';
import type { PlayerTrainingDay } from '@dugout/shared/training-center';
import { specialistSkill } from './coaching-specialties';
function report(g: GameState, p: Player, title: string, body: string) {
  postNews(g, `${p.name} · ${title}`, body, 'squad', {
    playerId: p.id,
    actionView: 'medical',
    sender: { name: '구단 의무팀', role: '회복·재활 보고' },
  });
}
export function repairMedicalSelection(g: GameState) {
  if (g.liveMatch) return;
  const eligible = firstTeam(g).filter(isAvailable),
    ids = new Set(eligible.map((p) => p.id));
  if (g.lineup.some((id) => !ids.has(id))) {
    const used = new Set(g.lineup.filter((id) => ids.has(id)));
    const bench = lineupAuto(eligible).filter((id) => !used.has(id));
    g.lineup = g.lineup.map((id) => (ids.has(id) ? id : bench.shift()!)).filter(Boolean);
  }
  preparePitching(g);
  g.defense = defenseFor(g);
}
export function medicalTick(g: GameState, trainingDays?: Map<string, PlayerTrainingDay>) {
  if (g.liveMatch) return;
  const today = gameDate(g);
  let added = false;
  for (const p of g.roster) {
    const injury = p.injury;
    if (injury) {
      if (injury.lastCheck === today) continue;
      injury.lastCheck = today;
      if (today >= injury.returnDate) {
        delete p.injury;
        p.condition = Math.max(70, p.condition);
        report(
          g,
          p,
          '복귀 승인',
          '재활을 마쳤습니다. 1군·2군 등록과 선발 명단을 직접 확인해 주세요.',
        );
      } else if (
        injury.phase === 'earlyReturn' &&
        hash(`${p.id}:${today}:recurrence`) % 100 < injury.recurrenceRisk / 7
      ) {
        injury.phase = 'treatment';
        injury.returnDate = addDays(injury.returnDate, 7);
        injury.earliestReturn = addDays(today, 5);
        injury.recurrenceRisk = Math.min(80, injury.recurrenceRisk + 15);
        p.condition = Math.min(45, p.condition);
        report(
          g,
          p,
          '부상 재발',
          `조기 복귀 후 증상이 재발했습니다. 복귀 예상 ${injury.returnDate}. 치료가 다시 필요합니다.`,
        );
      }
      continue;
    }
    if (added || g.phase === 'finished' || p.internationalDuty) continue;
    const risk =
      ((p.condition < 65 ? 12 : 3) *
        (trainingDays?.get(p.id)?.risk ?? (g.training === 'rest' ? 0.5 : 1))) /
      Math.max(1, g.facilities?.medical || 1);
    if (hash(`${g.seed}:${p.id}:${today}:injury`) % 1000 >= risk) continue;
    const peers = firstTeam(g).filter(isAvailable);
    // Retain a playable first team; reserve depth is available through normal roster moves.
    if (
      p.squad !== 'reserve' &&
      (peers.filter((x) => x.pos === p.pos).length <= { P: 3, C: 1, IF: 3, OF: 2, DH: 0 }[p.pos] ||
        (p.pos !== 'P' && peers.filter((x) => x.pos !== 'P').length <= 10))
    )
      continue;
    const roll = hash(`${p.id}:${today}:severity`) % 100;
    const days = roll < 70 ? 5 : roll < 95 ? 14 : 35;
    p.injury = {
      id: `injury-${p.id}-${today}`,
      name: p.pos === 'P' ? '팔·어깨 통증' : '근육·관절 부상',
      occurred: today,
      returnDate: addDays(today, days),
      earliestReturn: addDays(today, Math.ceil(days * 0.6)),
      severity: days === 5 ? 'minor' : days === 14 ? 'moderate' : 'major',
      phase: 'treatment',
      recurrenceRisk: days === 5 ? 20 : days === 14 ? 35 : 50,
      lastCheck: today,
    };
    p.condition = Math.min(55, p.condition);
    added = true;
    report(
      g,
      p,
      '의무팀 진단',
      `${p.injury.name}. 복귀 예상 ${p.injury.returnDate} · ${p.injury.earliestReturn}부터 조기 복귀 검토 가능. 재활을 선택하면 재발 위험을 줄일 수 있습니다.`,
    );
  }
  repairMedicalSelection(g);
}
export function medicalAction(g: GameState, a: Record<string, unknown>) {
  if (!['rehabPlayer', 'earlyReturnPlayer'].includes(String(a.type))) return null;
  if (g.liveMatch) throw new Error('경기 종료 후 의무팀과 상의해 주세요.');
  const p = g.roster.find((p) => p.id === a.id),
    injury = p?.injury;
  if (!p || !injury) throw new Error('치료 중인 소속 선수를 선택해 주세요.');
  if (a.type === 'rehabPlayer') {
    if (injury.phase === 'rehab') throw new Error('이미 재활 중입니다.');
    injury.phase = 'rehab';
    if (!injury.rehabilitated)
      injury.recurrenceRisk = Math.max(
        5,
        injury.recurrenceRisk - 10 - Math.round(specialistSkill(g, '재활') / 20),
      );
    injury.rehabilitated = true;
    report(
      g,
      p,
      '재활 프로그램 시작',
      `${injury.returnDate}까지 경기 출전을 쉬며 회복합니다. 재발 위험 ${injury.recurrenceRisk}%.`,
    );
  } else {
    if (gameDate(g) < injury.earliestReturn || injury.phase === 'earlyReturn')
      throw new Error('아직 조기 복귀할 수 없습니다.');
    if (a.confirm !== true) throw new Error('재발 위험을 확인하고 조기 복귀를 결정해 주세요.');
    injury.phase = 'earlyReturn';
    p.condition = Math.max(55, p.condition);
    report(
      g,
      p,
      '조기 복귀 결정',
      `출전이 가능하지만 예정 회복일까지 재발 위험 ${injury.recurrenceRisk}%/주가 적용됩니다.`,
    );
  }
  repairMedicalSelection(g);
  return g;
}
