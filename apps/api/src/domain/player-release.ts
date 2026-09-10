import type { GameState } from '@dugout/shared/types';
import { autoDefense, firstTeam } from '@dugout/shared/management';
import { lineupAuto, money } from '@dugout/shared/game-view';
import { preparePitching } from '@dugout/shared/pitching';
import { releaseCompensation, releaseError } from '@dugout/shared/player-release';
import { archivePlayer } from './world-simulation';
import { postNews } from './club-dynamics';

export function releasePlayer(g: GameState, a: Record<string, unknown>) {
  const p = g.roster.find((player) => player.id === a.id);
  if (!p) throw new Error('방출할 소속 선수를 찾을 수 없습니다.');
  const error = releaseError(g, p);
  if (error) throw new Error(error);
  if (a.confirm !== true) throw new Error('방출 정산 내용을 확인해 주세요.');
  const compensation = releaseCompensation(g, p);
  if (a.compensation !== compensation)
    throw new Error('정산 금액이 바뀌었습니다. 방출 조건을 다시 확인해 주세요.');
  archivePlayer(g, p, 'transfer', [], 'fa');
  g.budget -= compensation;
  g.expenses += compensation;
  g.ownership[p.id] = 'fa';
  g.transferred = [...g.transferred.filter((v) => v.id !== p.id), { ...p, club: 'fa', years: 0 }];
  g.roster = g.roster.filter((v) => v.id !== p.id);
  g.deals = g.deals.filter((d) => d.player.id !== p.id);
  g.saleOffers = g.saleOffers?.filter((o) => o.playerId !== p.id);
  if (g.transferListed) delete g.transferListed[p.id];
  if (g.lineup.includes(p.id)) g.lineup = lineupAuto(firstTeam(g));
  if (g.starter === p.id) g.starter = firstTeam(g).find((v) => v.pos === 'P')!.id;
  preparePitching(g);
  g.defense = autoDefense(g);
  for (const report of g.coachRecommendations || [])
    if (report.status === 'pending' && [report.playerId, report.replacementId].includes(p.id))
      report.status = 'dismissed';
  postNews(
    g,
    `${p.name} 방출`,
    `잔여 보장 연봉 ${money(compensation)}을 정산했습니다. 선수는 자유계약 신분이며 이후 구단 급여에서 제외됩니다.`,
    'transfer',
    { playerId: p.id, actionView: 'squad' },
  );
  return g;
}
