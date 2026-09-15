import type { GameState, Player } from '@dugout/shared/types';
import {
  remodelPlans,
  availableRemodels,
  remodelPause,
  remodelUsed,
  REMODEL_DAYS,
  type RemodelKind,
} from '@dugout/shared/player-remodel';
import { gameDate } from '@dugout/shared/calendar';
import { abilityLabels } from '@dugout/shared/development';
import { trainingRest } from '@dugout/shared/training-plan';
import type { PlayerTrainingDay } from '@dugout/shared/training-center';
import { postNews } from './club-dynamics';
export function remodelAction(g: GameState, a: Record<string, unknown>): GameState | null {
  if (!['startRemodel', 'cancelRemodel'].includes(String(a.type))) return null;
  if (g.liveMatch) throw new Error('경기를 마친 뒤 폼 개조를 변경해 주세요.');
  const p = g.roster.find((p) => p.id === a.id);
  if (!p) throw new Error('소속 선수를 선택해 주세요.');
  if (a.type === 'cancelRemodel') {
    if (p.remodel?.status !== 'training') throw new Error('진행 중인 폼 개조가 없습니다.');
    p.remodel.status = 'cancelled';
    p.remodel.finished = gameDate(g);
    p.remodel.finishedYear = g.year;
    return g;
  }
  if (p.remodel?.status === 'training' || remodelUsed(g, p))
    throw new Error(
      '선수별로 한 시즌에 한 번만 폼을 개조할 수 있습니다. 중단한 시즌에도 다시 시작할 수 없습니다.',
    );
  const kind = String(a.kind) as RemodelKind;
  if (!availableRemodels(p).includes(kind))
    throw new Error('투타 구분에 맞는 개조를 선택해 주세요.');
  if (
    g.roster.filter((p) => p.remodel?.status === 'training' && p.remodel.club === g.club).length >=
    3
  )
    throw new Error('코치진은 동시에 세 명까지 폼 개조를 지도할 수 있습니다.');
  const plan = remodelPlans[kind];
  if (p[plan.gain] >= Math.min(99, p.potential) - 0.1 || p[plan.cost] <= 20 + plan.loss)
    throw new Error(
      '현재 능력으로는 이 개조의 효과를 기대하기 어렵습니다. 다른 방향을 선택해 주세요.',
    );
  p.remodel = {
    kind,
    year: g.year,
    club: g.club,
    started: gameDate(g),
    days: 0,
    status: 'training',
  };
  return g;
}
export function advanceRemodel(g: GameState, p: Player, daily?: PlayerTrainingDay) {
  const r = p.remodel,
    date = gameDate(g);
  if (!r || r.status !== 'training' || r.lastDay === date || r.started === date) return;
  if (r.club !== g.club) {
    r.status = 'cancelled';
    r.finished = date;
    r.finishedYear = g.year;
    return;
  }
  if (remodelPause(g, p) || (daily ? daily.rest : g.training === 'rest' || trainingRest(g, p)))
    return;
  r.lastDay = date;
  r.days++;
  if (r.days < REMODEL_DAYS) return;
  const plan = remodelPlans[r.kind];
  const gain = Math.max(0, Math.min(plan.amount, Math.min(99, p.potential) - p[plan.gain]));
  const loss = Math.min(p[plan.cost] - 20, (plan.loss * gain) / plan.amount);
  p[plan.gain] += gain;
  p[plan.cost] -= loss;
  r.status = 'completed';
  r.finished = date;
  r.finishedYear = g.year;
  r.gained = gain;
  r.lost = loss;
  postNews(
    g,
    `${p.name}, ${plan.label} 완성`,
    `${REMODEL_DAYS}일의 훈련을 마쳤습니다. ${abilityLabels[plan.gain]} +${gain.toFixed(2)} · ${abilityLabels[plan.cost]} −${loss.toFixed(2)}. 바뀐 능력은 다음 경기부터 적용됩니다.`,
    'development',
    { id: `remodel:${p.id}:${r.year}`, playerId: p.id, actionView: 'squad' },
  );
}
