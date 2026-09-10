import type { GameState } from '@dugout/shared/types';
import { isClubSeasonRest } from '@dugout/shared/season-status';

export function prepareSeasonRest(g: GameState) {
  if (!isClubSeasonRest(g)) return;
  for (const report of g.coachRecommendations || [])
    if (report.status === 'pending') report.status = 'dismissed';
  for (const news of g.news) {
    if (news.lineupRecommendation?.status === 'pending')
      news.lineupRecommendation.status = 'dismissed';
    if (news.choiceKind === 'playingTime' && !news.choice) {
      news.choice = 'explain';
      news.read = true;
      news.body += '\n우리 팀 시즌이 종료되어 출전 요청을 마감했습니다. 선수단은 휴식합니다.';
    }
  }
}
