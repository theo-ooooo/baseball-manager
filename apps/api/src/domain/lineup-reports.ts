import { rotateLineup } from './lineup-rotation';
import { isClubSeasonRest } from '@dugout/shared/season-status';
import type { GameState, NewsItem, Player, WorldCatalog } from '@dugout/shared/types';
import { createGameView, lineupAuto } from '@dugout/shared/game-view';
import { firstTeam, autoDefense, preseasonFixtures } from '@dugout/shared/management';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import { lineupReason } from '@dugout/shared/player-attributes';
import { isAvailable } from '@dugout/shared/long-term';
import { lineupRecommendationError } from '@dugout/shared/lineup-recommendation';
import { postNews } from './club-dynamics';
import { preparePitching, starterScore } from '@dugout/shared/pitching';
const battingRecord = (p: Player) =>
  p.stats.ab >= 20
    ? `시즌 ${p.stats.ab}타수 · 타율 ${(p.stats.h / p.stats.ab).toFixed(3)}`
    : '시즌 표본 부족 · 기본 기량 중심';

export function createLineupReports(world: WorldCatalog) {
  const view = createGameView(world);
  function target(g: GameState) {
    if (isClubSeasonRest(g)) return null;
    if (g.phase === 'preseason') {
      const f = preseasonFixtures(g, world).find(
        (f) => f.day >= g.day && !g.history.some((m) => m.friendly && m.day === f.day),
      );
      return f
        ? {
            id: `friendly-${g.year}-${f.day}-${g.club}`,
            date: gameDate(g, f.day),
            home: f.pair[0],
            away: f.pair[1],
          }
        : null;
    }
    if (g.phase === 'regular')
      return (
        view
          .fixtures(g, view.getClub(g.club).league)
          .find(
            (f) =>
              f.date >= gameDate(g) &&
              [f.home, f.away].includes(g.club) &&
              !g.history.some((m) => m.fixtureId === f.id && m.date === f.date),
          ) || null
      );
    const pair = view.nextFixture(g);
    return pair
      ? {
          id: `post-${g.year}-${g.day}-${pair.join('-')}`,
          date: gameDate(g),
          home: pair[0],
          away: pair[1],
        }
      : null;
  }
  function prepare(g: GameState, refresh = false) {
    if (g.liveMatch || g.managerCareer?.status === 'unemployed') return;
    const fixture = target(g);
    if (!fixture || daysBetween(gameDate(g), fixture.date) > 0) return;
    const id = `lineup-report-${g.club}-${fixture.id}`,
      existing = g.news.find((n) => n.id === id);
    if (existing && !refresh) return;
    const active = firstTeam(g).filter(isAvailable),
      batters = active.filter((p) => p.pos !== 'P');
    const opponent = fixture.home === g.club ? fixture.away : fixture.home;
    // Opponent analysis uses public game scores, never hidden scouting attributes.
    const recent = (g.worldResults || [])
      .filter((m) => [m.home, m.away].includes(opponent))
      .slice(0, 5);
    const runs =
      recent.reduce((sum, m) => sum + (m.home === opponent ? m.homeScore : m.awayScore), 0) /
      Math.max(1, recent.length);
    const protectDefense = recent.length >= 3 && runs >= 5;
    const selection = lineupAuto(
      batters.map((p) => ({
        ...p,
        condition: Math.max(
          1,
          p.condition -
            (p.condition < 70 ? 20 : 0) +
            (p.stats.ab >= 20
              ? Math.max(-8, Math.min(8, (p.stats.h / p.stats.ab - 0.26) * 60))
              : 0) +
            (protectDefense ? (p.field - 60) * 0.25 : 0),
        ),
      })),
    );
    const rotationPlan = rotateLineup(g, batters, selection);
    const chosen = rotationPlan.ids.map((id) => batters.find((p) => p.id === id)!);
    const ids = lineupAuto(chosen);
    const pitchers = active.filter((p) => p.pos === 'P');
    const scheduled = pitchers.find((p) => p.id === g.starter);
    const rotation = pitchers.filter((p) => g.pitching?.rotation.includes(p.id));
    const starter =
      scheduled && scheduled.condition >= 65
        ? scheduled
        : [...(rotation.length ? rotation : pitchers)].sort(
            (a, b) => b.condition - a.condition || starterScore(b) - starterScore(a),
          )[0];
    if (ids.length !== 9 || !starter) return;
    const resting = g.roster.filter(
      (p) =>
        (g.lineup.includes(p.id) || p.id === g.starter) && ![...ids, starter.id].includes(p.id),
    );
    const coach = g.staff.find((c) => c.role === '타격') || g.staff[0];
    const defense = autoDefense({ ...g, lineup: ids, starter: starter.id, defense: undefined });
    const explanation = (p: Player) =>
      !isAvailable(p)
        ? `${p.injury?.name || '부상'} · 출전 제외`
        : rotationPlan.changes.some((change) => change.outgoing.id === p.id)
          ? `최근 기용이 많아 휴식 · 같은 포지션의 ${rotationPlan.changes.find((change) => change.outgoing.id === p.id)!.incoming.name}에게 출전 기회 분배`
          : p.squad === 'reserve'
            ? '현재 2군 소속'
            : p.condition < 70
              ? `컨디션 ${Math.round(p.condition)}% · 1군을 유지하며 선발 휴식`
              : `${battingRecord(p)} · 같은 포지션 선수의 기량·컨디션${protectDefense ? '·수비력' : ''} 비교`;
    const recommendation: NonNullable<NewsItem['lineupRecommendation']> = {
      club: g.club,
      fixture: fixture.id,
      date: fixture.date,
      opponent,
      ids,
      starter: starter.id,
      status: 'pending',
    };
    const extra: Partial<NewsItem> = {
      id,
      actionView: 'tactics',
      lineupRecommendation: recommendation,
      sender: { name: coach?.name || '수석 코치', role: '다음 경기 선발 명단 · 타순 제안' },
      report: {
        facts: [
          { label: '경기', value: `${fixture.date} · ${view.getClub(opponent).name}전` },
          {
            label: '추천 선발',
            value: `${starter.name} · 컨디션 ${Math.round(starter.condition)}%`,
          },
          {
            label: '선발 선정',
            value:
              starter.id === g.starter
                ? '현재 선발 순서 유지'
                : '기존 선발의 피로·출전 가능 여부를 확인하고 대체 선발 추천',
          },
        ],
        sections: [
          {
            title: '출전 기회 분배',
            body: rotationPlan.changes.length
              ? rotationPlan.changes
                  .map(
                    ({ incoming, outgoing, recent, sample }) =>
                      `${incoming.name}: 최근 ${sample}경기 중 ${recent}경기 출전${incoming.mood ? ` · 사기 ${incoming.mood.value}` : ''}. 기량 차이가 크지 않은 같은 포지션의 ${outgoing.name}와 선발 기회를 나눕니다.${incoming.mood && incoming.mood.value < 50 ? ' 낮은 사기와 출전 부족을 함께 고려했습니다.' : ''}`,
                  )
                  .join('\n')
              : '최근 출전량·포지션·컨디션을 함께 검토했습니다. 전력과 수비 배치를 유지하면서 비교 가능한 후보에게 다음 기회를 배분합니다.',
          },
          {
            title: '상대 팀과 기용 방향',
            body:
              recent.length >= 3
                ? `상대 최근 ${recent.length}경기 평균 ${runs.toFixed(1)}득점. ${protectDefense ? '실점을 줄이기 위해 같은 포지션의 수비력을 추가로 고려했습니다.' : '우리 선수의 출루·장타 생산과 컨디션을 중심으로 편성했습니다.'}`
                : '상대의 최근 경기 표본이 부족합니다. 우리 선수의 기량과 컨디션을 중심으로 편성했습니다.',
          },
          ...(resting.length
            ? [
                {
                  title: '기존 선발에서 제외한 이유',
                  body: resting.map((p) => `${p.name}: ${explanation(p)}`).join('\n'),
                },
              ]
            : []),
        ],
        players: ids.map((id, i) => {
          const p = batters.find((p) => p.id === id)!;
          return {
            id,
            name: `${i + 1}번 ${p.name}`,
            detail: `${rotationPlan.changes.some((change) => change.incoming.id === p.id) ? '출전 기회 분배 · ' : ''}${Object.entries(defense).find(([pos, pid]) => pos !== 'P' && pid === id)?.[0] || p.pos} · 컨디션 ${Math.round(p.condition)}% · ${lineupReason(p, i)} · ${battingRecord(p)}`,
          };
        }),
      },
    };
    const title = `${view.getClub(opponent).name}전 · 추천 선발 명단과 타순`,
      body =
        '다음 경기에 사용할 선발 9명과 타순, 선발 투수를 제안드립니다. 적용하면 추천 명단에 맞춰 수비도 함께 배치합니다. 선수 등록이나 투수 보직은 바뀌지 않습니다.';
    if (existing && refresh)
      Object.assign(existing, { title, body, date: gameDate(g), day: g.day, read: false }, extra);
    else postNews(g, title, body, 'lineup', extra);
  }
  function action(g: GameState, a: Record<string, unknown>) {
    if (a.type !== 'lineupRecommendation') return null;
    const news = g.news.find((n) => n.id === a.id),
      report = news?.lineupRecommendation;
    if (!news || !report) throw new Error('추천 보고서를 찾을 수 없습니다.');
    if (g.liveMatch || g.managerCareer?.status === 'unemployed' || report.club !== g.club)
      throw new Error('현재 소속 구단의 경기 준비 화면에서 확인해 주세요.');
    const fixture = target(g);
    if (!fixture || fixture.id !== report.fixture)
      throw new Error('다음 경기 일정이 달라졌습니다. 새 보고서를 확인해 주세요.');
    if (a.choice === 'refresh') {
      prepare(g, true);
      return g;
    }
    if (a.choice === 'dismiss') {
      if (report.status !== 'pending') throw new Error('이미 처리한 보고서입니다.');
      report.status = 'dismissed';
      return g;
    }
    if (a.choice !== 'apply') throw new Error('추천 명단 처리 방법을 선택해 주세요.');
    const error = lineupRecommendationError(g, news);
    if (error) throw new Error(error);
    g.lineup = [...report.ids];
    g.starter = report.starter;
    g.defense = autoDefense(g);
    preparePitching(g);
    report.status = 'applied';
    news.read = true;
    return g;
  }
  return { prepare, action };
}
