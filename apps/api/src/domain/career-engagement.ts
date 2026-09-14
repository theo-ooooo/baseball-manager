import type { GameState, Result } from '@dugout/shared/types';
import {
  prospectGoals,
  prospectProgress,
  type ProspectGoal,
  type RivalRecord,
} from '@dugout/shared/career-engagement';
import { gameDate } from '@dugout/shared/calendar';
import { matchBoxScore } from '@dugout/shared/match-box-score';
import { managerRelationshipReaction, awardManagerAchievement } from './manager-journey';

export function prepareEngagement(g: GameState) {
  g.engagement ??= {
    interviews: 'coach',
    prospects: [],
    rivals: [],
    support: { club: g.club, value: 50 },
  };
  if (g.engagement.support.club !== g.club) g.engagement.support = { club: g.club, value: 50 };
}
export function engagementAction(g: GameState, a: Record<string, unknown>) {
  if (
    !['careerInterviews', 'careerReportMode', 'followProspect', 'unfollowProspect'].includes(
      String(a.type),
    )
  )
    return null;
  if (g.liveMatch) throw new Error('진행 중인 경기를 마친 뒤 변경해 주세요.');
  prepareEngagement(g);
  if (a.type === 'careerInterviews') {
    if (!['manual', 'coach'].includes(String(a.mode)))
      throw new Error('인터뷰 진행 방식을 선택해 주세요.');
    g.engagement!.interviews = a.mode as 'manual' | 'coach';
    return g;
  }
  if (a.type === 'careerReportMode') {
    if (!['important', 'all'].includes(String(a.mode)))
      throw new Error('보고 진행 방식을 선택해 주세요.');
    g.engagement!.reportMode = a.mode as 'important' | 'all';
    return g;
  }
  if (g.managerCareer?.status !== 'employed' || g.managerCareer.vacationUntil)
    throw new Error('구단에 복귀한 뒤 육성 선수를 지명해 주세요.');
  const stories = g.engagement!.prospects;
  const old = stories.find((s) => s.id === a.id && s.club === g.club);
  if (a.type === 'unfollowProspect') {
    if (old) old.active = false;
    return g;
  }
  const p = g.roster.find((p) => p.id === a.id);
  if (!p || p.age > 23) throw new Error('우리 구단의 23세 이하 선수를 선택해 주세요.');
  const goal = a.goal as ProspectGoal;
  if (
    !Object.hasOwn(prospectGoals, goal) ||
    (p.pos === 'P' ? ['hits', 'homer'].includes(goal) : goal === 'strikeouts')
  )
    throw new Error('선수 포지션에 맞는 목표를 선택해 주세요.');
  if (stories.filter((s) => s.active && s.club === g.club && s.id !== p.id).length >= 3)
    throw new Error('한 번에 세 명까지 집중해서 지켜볼 수 있습니다.');
  if (old) {
    old.active = true;
    return g;
  }
  // Keep a completed goal immutable when following a player again: no repeat morale reward.
  if (stories.length >= 30)
    throw new Error(
      '이 커리어의 육성 기록 30명을 모두 사용했습니다. 기존 선수를 다시 지명할 수 있습니다.',
    );
  stories.push({
    id: p.id,
    name: p.name,
    club: g.club,
    since: gameDate(g),
    goal,
    active: true,
    starts: 0,
    hits: 0,
    homers: 0,
    strikeouts: 0,
    games: 0,
    moments: [],
  });
  return g;
}
function rivalry(g: GameState, opponent: string) {
  const e = g.engagement!;
  let r = e.rivals.find((r) => r.club === g.club && r.opponent === opponent);
  if (r) return r;
  r = { club: g.club, opponent, w: 0, l: 0, d: 0, recent: [], lastDate: gameDate(g) };
  for (const m of [...g.history]
    .reverse()
    .filter(
      (m) =>
        !m.friendly && [m.home, m.away].includes(g.club) && [m.home, m.away].includes(opponent),
    ))
    addResult(r, g, m);
  e.rivals.push(r);
  e.rivals = e.rivals.slice(-40);
  return r;
}
function addResult(r: RivalRecord, g: GameState, m: Result) {
  const own = m.home === g.club ? m.homeScore : m.awayScore,
    opp = m.home === g.club ? m.awayScore : m.homeScore;
  const outcome: 'W' | 'L' | 'D' = own === opp ? 'D' : own > opp ? 'W' : 'L';
  if (outcome === 'W') r.w++;
  else if (outcome === 'L') r.l++;
  else r.d++;
  r.recent = [...r.recent, outcome].slice(-5);
  r.lastDate = m.date || gameDate(g);
}
export function recordEngagementMatch(g: GameState, result: Result) {
  if (
    result.friendly ||
    ![result.home, result.away].includes(g.club) ||
    g.managerCareer?.status !== 'employed'
  )
    return;
  prepareEngagement(g);
  const e = g.engagement!,
    date = result.date || gameDate(g);
  if (
    e.lastMatch &&
    (date < e.lastMatch.date || (date === e.lastMatch.date && e.lastMatch.ids.includes(result.id)))
  )
    return;
  e.lastMatch = {
    date,
    ids: [...(e.lastMatch?.date === date ? e.lastMatch.ids : []), result.id].slice(-8),
  };
  const side = result.home === g.club ? 1 : 0,
    opponent = side ? result.away : result.home;
  addResult(rivalry(g, opponent), g, result);
  if (g.challenge?.status === 'active' && g.challenge.club === g.club && !result.post)
    g.challenge.played++;
  const moments: { playerId: string; title: string }[] = [];
  const own = matchBoxScore(result)[side];
  for (const story of e.prospects.filter((s) => s.active && s.club === g.club)) {
    const batter = own.batters.find((p) => p.id === story.id),
      pitcher = own.pitchers.find((p) => p.id === story.id);
    if (!batter && !pitcher) continue;
    story.games++;
    const start =
      result.replayTeams?.[side]?.lineup.includes(story.id) ||
      result.replayTeams?.[side]?.defense.P === story.id;
    if (start) story.starts++;
    story.hits += batter?.h || 0;
    story.homers += batter?.hr || 0;
    story.strikeouts += pitcher?.k || 0;
    const mark = (key: string, title: string) => {
      if (story.moments.some((m) => m.key === key)) return;
      story.moments.push({ key, date, title, matchId: result.id });
      moments.push({ playerId: story.id, title: `${story.name} · ${title}` });
    };
    mark('appearance', '육성 지명 후 첫 1군 출전');
    if (start) mark('start', '선발 기회를 잡았습니다');
    if (batter?.h) mark('hit', '기다리던 첫 안타');
    if (batter?.hr) mark('homer', '담장을 넘겼습니다!');
    if (pitcher?.k) mark('strikeout', '첫 탈삼진을 잡았습니다');
    if (!story.completed && prospectProgress(story) >= prospectGoals[story.goal].target) {
      story.completed = date;
      mark('goal', `${prospectGoals[story.goal].label} 달성`);
      const p = g.roster.find((p) => p.id === story.id);
      if (p?.mood) {
        p.mood.value = Math.min(100, p.mood.value + 3);
        p.mood.reason = '감독과 정한 육성 목표를 달성해 자신감을 얻음';
      }
      managerRelationshipReaction(g, story.id, 2);
      awardManagerAchievement(
        g,
        `prospect:${story.club}:${story.id}`,
        '내가 믿은 선수',
        `${story.name}: ${prospectGoals[story.goal].label} 달성`,
        story.id,
      );
    }
  }
  const stakes = result.story?.stakes;
  if (stakes) {
    const before = e.support.value,
      win =
        (side ? result.homeScore : result.awayScore) > (side ? result.awayScore : result.homeScore),
      draw = result.homeScore === result.awayScore;
    e.support.value = Math.max(20, Math.min(80, before + (draw ? 0 : win ? 3 : -2)));
    const message = draw
      ? '팬들은 다음 맞대결을 기다립니다.'
      : win
        ? '중요한 맞대결을 잡았습니다. 팬들의 기대가 커집니다.'
        : '아쉬운 패배입니다. 다음 맞대결에서 만회할 기회가 남아 있습니다.';
    result.story = { stakes, moments, support: { before, after: e.support.value, message } };
  } else if (moments.length) result.story = { moments };
}
export function gateSupport(g: GameState) {
  return g.engagement?.support.club === g.club ? 1 + (g.engagement.support.value - 50) * 0.002 : 1;
}
