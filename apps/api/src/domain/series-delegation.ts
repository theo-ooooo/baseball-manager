import type { GameState, WorldCatalog, Fixture } from '@dugout/shared/types';
import { createCalendarView, gameDate, daysBetween } from '@dugout/shared/calendar';
import { currentPostseasonRound } from '@dugout/shared/postseason';
import { preseasonSkipBlockers, describePreseasonSkipBlockers } from '@dugout/shared/preseason';
import { importantCareerReport } from '@dugout/shared/career-pace';
import { conversationKey } from '@dugout/shared/match-media';
import { prepareEngagement } from './career-engagement';
import { createMatchMediaActions } from './match-media-actions';
import { postNews } from './club-dynamics';

type Engine = {
  nextFixture: (g: GameState) => string[] | null | undefined;
  advance: (g: GameState, count?: number, pauseAfterOwn?: boolean) => GameState;
  liveAction: (g: GameState, a: Record<string, unknown>) => GameState | null;
};
export function createSeriesDelegation(world: WorldCatalog, engine: Engine) {
  const calendar = createCalendarView(world),
    media = createMatchMediaActions(world);
  const fixtures = (g: GameState): Fixture[] =>
    g.phase === 'regular'
      ? calendar.fixtures(g, world.clubs.find((c) => c.id === g.club)!.league)
      : currentPostseasonRound(g)?.fixtures.filter(
          (f) => f.status === 'scheduled' || f.status === 'conditional',
        ) || [];
  const coach = (g: GameState) =>
    g.staff.some(
      (c) => c.role !== '스카우트' && (c.contractUntil === undefined || c.contractUntil > g.year),
    );
  const blocker = (g: GameState) => {
    if (g.news.some((n) => n.choiceKind && !n.choice)) return '선수와의 필수 면담에 답변해 주세요.';
    const blocks = preseasonSkipBlockers(g);
    if (blocks.length) return describePreseasonSkipBlockers(blocks);
    if (g.news.some((n) => !n.read && importantCareerReport(g, n)))
      return '중요한 새 보고를 확인해 주세요.';
    return '';
  };
  function finish(g: GameState, reason: string, complete = false) {
    const run = g.engagement!.seriesRun!;
    run.status = complete ? 'completed' : 'interrupted';
    run.reason = reason;
    postNews(g, `연전 위임 ${complete ? '완료' : '중지'} · ${run.played}경기`, reason, 'match', {
      id: `series:${run.id}:${run.played}`,
      actionView: 'schedule',
    });
    return g;
  }
  return (g: GameState, a: Record<string, unknown>) => {
    if (
      !['beginSeriesDelegation', 'delegateSeriesDay', 'stopSeriesDelegation'].includes(
        String(a.type),
      )
    )
      return null;
    prepareEngagement(g);
    if (a.type === 'stopSeriesDelegation') {
      if (g.engagement!.seriesRun?.status === 'running')
        return finish(g, '감독이 연전 위임을 멈췄습니다.');
      return g;
    }
    if (g.liveMatch) throw new Error('진행 중인 경기부터 마쳐 주세요.');
    if (g.managerCareer?.status !== 'employed' || g.managerCareer.vacationUntil)
      throw new Error('구단에서 직접 지휘 중일 때 연전을 맡길 수 있습니다.');
    if (!coach(g)) throw new Error('경기를 맡길 코치가 필요합니다.');
    if (a.type === 'beginSeriesDelegation') {
      if (g.engagement!.seriesRun?.status === 'running')
        throw new Error('이미 연전 위임이 진행 중입니다.');
      if (g.phase === 'preseason' || g.phase === 'finished')
        throw new Error('정규시즌이나 포스트시즌 경기일에 맡길 수 있습니다.');
      const block = blocker(g);
      if (block) throw new Error(block);
      const pair = engine.nextFixture(g);
      if (!pair) throw new Error('오늘 경기 준비 화면에서 연전을 맡겨 주세요.');
      const opponent = pair.find((id) => id !== g.club)!;
      const remaining = fixtures(g).filter(
        (f) => f.date >= gameDate(g) && [f.home, f.away].includes(g.club),
      );
      const ids: string[] = [];
      let previous = gameDate(g);
      for (const f of remaining) {
        if (
          ![f.home, f.away].includes(opponent) ||
          daysBetween(previous, f.date) > 2 ||
          ids.length >= 3
        )
          break;
        ids.push(f.id);
        previous = f.date;
      }
      if (!ids.length) throw new Error('위임할 연전 일정이 없습니다.');
      g.engagement!.seriesRun = {
        id: `${g.year}-${g.day}-${g.club}`,
        club: g.club,
        opponent,
        phase: g.phase,
        fixtures: ids,
        played: 0,
        started: gameDate(g),
        days: 0,
        status: 'running',
        results: [],
      };
      return g;
    }
    const run = g.engagement!.seriesRun;
    if (!run || run.status !== 'running') throw new Error('연전 위임을 먼저 시작해 주세요.');
    if (run.club !== g.club || run.phase !== g.phase)
      return finish(g, '라운드나 소속 구단이 바뀌었습니다.', true);
    const block = blocker(g);
    if (block) return finish(g, block);
    if (run.days >= 14)
      return finish(g, '날씨와 일정 변경으로 14일을 진행했습니다. 남은 일정을 직접 확인해 주세요.');
    const pair = engine.nextFixture(g),
      before = new Set(g.news.map((n) => n.id));
    if (pair) {
      const fixture = fixtures(g).find(
        (f) => f.date === gameDate(g) && f.home === pair[0] && f.away === pair[1],
      );
      if (!fixture || !run.fixtures.includes(fixture.id))
        return finish(g, '선택한 연전이 끝났습니다.', true);
      if (g.media?.pending)
        media(g, {
          type: 'matchConversation',
          stage: 'post',
          key: g.media.pending.key,
          delegated: true,
        });
      if (g.media?.preparedFor !== conversationKey(g, pair))
        media(g, {
          type: 'matchConversation',
          stage: 'pre',
          key: conversationKey(g, pair),
          delegated: true,
        });
      engine.liveAction(g, { type: 'delegateMatch', date: gameDate(g), matchCards: true });
      const result = g.history.find((r) => r.fixtureId === fixture.id);
      if (!result) throw new Error('위임한 경기 결과를 확인할 수 없습니다.');
      run.played++;
      run.results.push(result.id);
      if (g.media?.pending)
        media(g, {
          type: 'matchConversation',
          stage: 'post',
          key: g.media.pending.key,
          delegated: true,
        });
    } else engine.advance(g, 1, true);
    run.days++;
    if (run.played >= run.fixtures.length || g.phase !== run.phase)
      return finish(
        g,
        `${run.played}경기를 코치가 지휘했습니다. 기록과 다음 선발을 확인하세요.`,
        true,
      );
    const after = blocker(g);
    if (after || g.news.some((n) => !before.has(n.id) && importantCareerReport(g, n)))
      return finish(g, after || '중요한 새 보고가 도착했습니다.');
    return g;
  };
}
