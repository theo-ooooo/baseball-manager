import type { GameState, WorldCatalog } from '@dugout/shared/types';
import { challengeDefinitions, type CareerChallenge } from '@dugout/shared/career-engagement';
import { createCalendarView, gameDate, daysBetween } from '@dugout/shared/calendar';
import { rankStandings } from '@dugout/shared/game-view';
import { isPostseasonPhase } from '@dugout/shared/postseason';
import { postNews } from './club-dynamics';
import { awardManagerAchievement } from './manager-journey';

export function configureChallenge(
  g: GameState,
  world: WorldCatalog,
  kind: CareerChallenge['kind'],
) {
  if (
    !Object.hasOwn(challengeDefinitions, kind) ||
    world.clubs.find((c) => c.id === g.club)?.league !== 'kbo'
  )
    throw new Error('KBO 도전 유형과 구단을 확인해 주세요.');
  g.mode = 'short';
  g.phase = 'regular';
  g.day = 0;
  g.rules!.preseason = false;
  if (kind === 'chase') {
    const rows = g.standings.kbo,
      ids = rows.filter((r) => r.club !== g.club).map((r) => r.club);
    ids.splice(5, 0, g.club);
    const wins = [17, 16, 15, 14, 13, 10, 6, 4, 3, 2];
    for (const [i, id] of ids.entries())
      Object.assign(
        rows.find((r) => r.club === id)!,
        { w: wins[i], l: 20 - wins[i], d: 0, rf: 80 + wins[i], ra: 100 - wins[i], form: [] },
      );
    g.calendar = {
      openingDate: `${g.year}-09-01`,
      startDay: 0,
      remaining: Object.fromEntries(world.clubs.map((c) => [c.id, c.league === 'kbo' ? 10 : 0])),
    };
    const fs = createCalendarView(world).fixtures(g, 'kbo');
    g.rounds = Math.max(...fs.map((f) => daysBetween(g.calendar!.openingDate, f.date) + 1));
    delete g.weather;
    // The fictional starting table is a baseline, never newly played manager results.
    for (const row of rows) {
      const job = g.managerJobs?.[row.club];
      if (!job) continue;
      job.startWins = row.w;
      job.startLosses = row.l;
      job.startDraws = row.d;
      job.appointed = gameDate(g);
      for (const person of Object.values(g.managerPeople || {}))
        for (const entry of person.career)
          if (entry.active && entry.club === row.club) entry.from = job.appointed;
    }
    if (g.managerCareer?.journey) {
      g.managerCareer.journey.started = gameDate(g);
      g.managerCareer.journey.ledger.date = gameDate(g);
    }
  }
  g.challenge = {
    kind,
    club: g.club,
    startedYear: g.year,
    started: gameDate(g),
    status: 'active',
    played: 0,
  };
  if (g.managerCareer?.contract) {
    g.managerCareer.contract.signed = gameDate(g);
    g.managerCareer.contract.throughYear = g.year + 1;
    g.managerCareer.contract.targetRank = kind === 'chase' ? 5 : 10;
  }
  g.news = [];
  postNews(
    g,
    challengeDefinitions[kind].title,
    `${challengeDefinitions[kind].detail}\n${kind === 'chase' ? '이 도전의 시작 순위와 앞선 20경기 성적은 가상 상황입니다. 시작 후 경기는 실제 게임 엔진으로 진행합니다.' : '단축 시즌 두 번 안에 상위 5위 진출을 노립니다.'}\n도전 저장은 본 커리어와 분리됩니다. 언제든 본 커리어로 돌아갈 수 있습니다.`,
    'challenge',
  );
}
export function tickChallenge(g: GameState, world: WorldCatalog) {
  const c = g.challenge;
  if (!c || c.status !== 'active') return;
  let message = '';
  if (g.club !== c.club || g.managerCareer?.status === 'unemployed') {
    c.status = 'failed';
    message = '도전 구단의 지휘봉을 내려놓았습니다.';
  } else if (isPostseasonPhase(g.phase) || g.phase === 'finished') {
    const league = world.clubs.find((t) => t.id === c.club)!.league;
    const qualified =
      g.postseason?.seeds?.includes(c.club) ??
      rankStandings(g.standings[league])
        .slice(0, 5)
        .some((s) => s.club === c.club);
    if (qualified) {
      c.status = 'success';
      message = '포스트시즌 진출 확정! 목표를 이뤘습니다.';
    } else if (c.kind === 'chase' || g.year >= c.startedYear + 1) {
      c.status = 'failed';
      message = '정해진 기간 안에 포스트시즌 진출을 이루지 못했습니다.';
    }
  }
  if (c.status === 'active') return;
  c.completed = gameDate(g);
  c.message = message;
  postNews(
    g,
    `${c.status === 'success' ? '도전 성공!' : '도전 종료'} · ${challengeDefinitions[c.kind].title}`,
    message,
    'challenge',
    { priority: 'story' },
  );
  if (c.status === 'success')
    awardManagerAchievement(
      g,
      `challenge:${c.kind}:${c.started}`,
      challengeDefinitions[c.kind].title,
      message,
    );
}
