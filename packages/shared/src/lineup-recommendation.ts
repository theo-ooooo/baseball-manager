import type { GameState, NewsItem } from './types';
import { gameDate } from './calendar';
import { isAvailable } from './long-term';
export type LineupRecommendation = {
  club: string;
  fixture: string;
  date: string;
  opponent: string;
  ids: string[];
  starter: string;
  status: 'pending' | 'applied' | 'dismissed';
};
export function lineupRecommendationError(g: GameState, news: NewsItem) {
  const r = news.lineupRecommendation;
  if (!r || r.club !== g.club || g.managerCareer?.status === 'unemployed')
    return '현재 소속 구단의 추천이 아닙니다.';
  if (r.status !== 'pending')
    return r.status === 'applied' ? '추천 명단 적용 완료' : '기존 명단 유지';
  if (g.liveMatch) return '경기 진행 중에는 경기장에서 선수를 교체해 주세요.';
  if (
    gameDate(g) > r.date ||
    g.history.some(
      (m) =>
        (m.fixtureId
          ? m.fixtureId === r.fixture
          : m.date === r.date && [m.home, m.away].includes(r.opponent)) &&
        [m.home, m.away].includes(g.club),
    )
  )
    return '이미 지난 경기의 보고서입니다.';
  const active = new Map(
    g.roster.filter((p) => p.squad !== 'reserve' && isAvailable(p)).map((p) => [p.id, p]),
  );
  if (
    r.ids.length !== 9 ||
    new Set(r.ids).size !== 9 ||
    r.ids.some((id) => !active.has(id) || active.get(id)!.pos === 'P') ||
    active.get(r.starter)?.pos !== 'P'
  )
    return '등록·부상 상태가 달라졌습니다. 코치에게 다시 추천받아 주세요.';
  if ([...r.ids, r.starter].some((id) => active.get(id)!.condition < 55))
    return '추천 선수의 피로가 누적됐습니다. 코치에게 다시 추천받아 주세요.';
  return null;
}
