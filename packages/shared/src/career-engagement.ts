import type { GameState, WorldCatalog } from './types';
import { gameDate } from './calendar';
import { rankStandings } from './game-view';
import { clubResults } from './club-results';

export type ProspectGoal = 'starts' | 'hits' | 'homer' | 'strikeouts';
export const prospectGoals: Record<ProspectGoal, { label: string; target: number; unit: string }> =
  {
    starts: { label: '1군 선발 3경기', target: 3, unit: '경기' },
    hits: { label: '1군 안타 5개', target: 5, unit: '안타' },
    homer: { label: '1군 홈런 1개', target: 1, unit: '홈런' },
    strikeouts: { label: '1군 탈삼진 5개', target: 5, unit: '탈삼진' },
  };
export type ProspectStory = {
  id: string;
  name: string;
  club: string;
  since: string;
  goal: ProspectGoal;
  active: boolean;
  starts: number;
  hits: number;
  homers: number;
  strikeouts: number;
  games: number;
  completed?: string;
  moments: { key: string; date: string; title: string; matchId: string }[];
};
export type RivalRecord = {
  club: string;
  opponent: string;
  w: number;
  l: number;
  d: number;
  recent: ('W' | 'L' | 'D')[];
  lastDate: string;
};
export type MatchStakes = {
  kind: 'revenge' | 'race' | 'reunion';
  title: string;
  detail: string;
  opponent: string;
};
export type CareerEngagement = {
  tactics?: import('./tactical-duel').TacticalMemory;
  competitions?: import('./lineup-competition').LineupCompetition[];
  reportMode?: 'important' | 'all';
  interviews?: 'manual' | 'coach';
  prospects: ProspectStory[];
  rivals: RivalRecord[];
  support: { club: string; value: number };
  lastMatch?: { date: string; ids: string[] };
  seriesRun?: {
    id: string;
    club: string;
    opponent: string;
    phase: GameState['phase'];
    fixtures: string[];
    played: number;
    started: string;
    days: number;
    status: 'running' | 'completed' | 'interrupted';
    reason?: string;
    results: string[];
  };
};
export type MatchStory = {
  stakes?: MatchStakes;
  moments: { playerId: string; title: string }[];
  support?: { before: number; after: number; message: string };
};
export type CareerChallenge = {
  kind: 'chase' | 'rebuild';
  club: string;
  startedYear: number;
  started: string;
  status: 'active' | 'success' | 'failed';
  played: number;
  completed?: string;
  message?: string;
};
export const challengeDefinitions = {
  chase: {
    title: '열 경기의 기적',
    detail: '정규시즌 10경기 남은 6위. 5위와 3경기 차를 뒤집고 포스트시즌에 진출하세요.',
    goal: '10경기 뒤 상위 5위',
    badge: '단기 승부',
  },
  rebuild: {
    title: '약체의 반란',
    detail: '키움 히어로즈를 맡아 두 시즌 안에 포스트시즌으로 이끄세요.',
    goal: '두 시즌 안에 상위 5위',
    badge: '단축 시즌 2회',
  },
} as const;
export function prospectProgress(story: ProspectStory) {
  return story.goal === 'homer'
    ? story.homers
    : story.goal === 'hits'
      ? story.hits
      : story.goal === 'strikeouts'
        ? story.strikeouts
        : story.starts;
}
export function matchStakes(
  g: GameState,
  world: Pick<WorldCatalog, 'clubs'>,
  opponent: string,
): MatchStakes | undefined {
  if (g.phase === 'preseason' || opponent === g.club) return;
  const name = world.clubs.find((c) => c.id === opponent)?.name || opponent;
  const rival = g.engagement?.rivals.find((r) => r.club === g.club && r.opponent === opponent);
  // Older saves may use only matches actually present in their archive summary.
  const recent =
    rival?.recent ||
    clubResults(g)
      .filter(
        (r) =>
          !r.friendly && [r.home, r.away].includes(g.club) && [r.home, r.away].includes(opponent),
      )
      .slice(0, 3)
      .reverse()
      .map((r) => {
        const own = r.home === g.club ? r.homeScore : r.awayScore,
          against = r.home === g.club ? r.awayScore : r.homeScore;
        return own === against ? 'D' : own > against ? 'W' : 'L';
      });
  if (recent.length >= 2 && recent.slice(-2).every((r) => r === 'L'))
    return {
      kind: 'revenge',
      title: '이번에는 돌려줄 차례',
      detail: `${name}와의 최근 두 맞대결에서 졌습니다. 오늘은 패배의 흐름을 끊을 기회입니다.`,
      opponent,
    };
  if (g.managerCareer?.history.some((h) => h.club === opponent))
    return {
      kind: 'reunion',
      title: '익숙한 구장, 다른 더그아웃',
      detail: `이전에 지휘했던 ${name}와 다시 만납니다. 오늘은 상대 감독으로 승부합니다.`,
      opponent,
    };
  const league = world.clubs.find((c) => c.id === g.club)?.league;
  const rows = rankStandings(g.standings[league || ''] || []),
    own = rows.find((r) => r.club === g.club),
    other = rows.find((r) => r.club === opponent);
  if (
    g.phase === 'regular' &&
    own &&
    other &&
    own.w + own.l + own.d >= 4 &&
    other.w + other.l + other.d >= 4
  ) {
    const gap = Math.abs((own.w - other.w + other.l - own.l) / 2);
    if (gap <= 2 && Math.min(rows.indexOf(own), rows.indexOf(other)) < (league === 'kbo' ? 5 : 4))
      return {
        kind: 'race',
        title: '순위표가 움직이는 맞대결',
        detail: `${name}와 ${gap === 0 ? '승차가 없습니다' : `${gap}경기 차입니다`}. 한 경기 결과가 가을야구 경쟁에 바로 닿습니다.`,
        opponent,
      };
  }
}
export function routineBriefing(
  g: GameState,
  isImportant: (g: GameState, n: GameState['news'][number]) => boolean,
) {
  const date = gameDate(g),
    from = new Date(Date.parse(`${date}T12:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const news = g.news.filter(
    (n) =>
      (n.date || gameDate({ ...g, year: n.year || g.year }, n.day)) >= from && !isImportant(g, n),
  );
  const matches = clubResults(g).filter(
    (m) => (m.date || gameDate(g, m.day)) >= from && !m.friendly,
  );
  const wins = matches.filter(
    (m) =>
      (m.home === g.club ? m.homeScore : m.awayScore) >
      (m.home === g.club ? m.awayScore : m.homeScore),
  ).length;
  return { news, matches: matches.length, wins, unread: news.filter((n) => !n.read).length };
}
