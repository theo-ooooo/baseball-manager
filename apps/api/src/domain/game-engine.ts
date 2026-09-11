import { prepareSeasonRest } from './season-rest';
import { scoutingGuide } from '@dugout/shared/scouting-guide';
import { createInternational } from './international';
import { pendingReadIds } from '@dugout/shared/inbox-read-intent';
import { createLineupReports } from './lineup-reports';
import { createAiRegistrations } from './ai-registrations';
import { createTrades } from './trades';
import { createRookieDraft } from './rookie-draft';
import { medicalTick, medicalAction, repairMedicalSelection } from './medical';
import { isAvailable } from '@dugout/shared/long-term';
import { resetBoardBaseline, recordBoardAppearances } from './board-objectives';
import { createManagerCareer } from './manager-career';
import {
  archivePlayer,
  createWorldSimulation,
  prepareWorld,
  saveWorldPlayer,
} from './world-simulation';
import { prepareFinances, settleClubDay } from './club-finance';
import { coachReports, coachReportAction } from './coach-reports';
import { isUnemployed } from '@dugout/shared/manager-career';
import { createMatchSimulator } from './match-simulation';
import { createLiveMatchActions } from './live-match';
import { applyMatchEffects, runMatch } from './match-timeline';
import { createCalendarProgression } from './calendar-progression';
import { createRecruitment } from './recruitment';
import { createScouting, prepareKnowledge } from './scouting';
import { individualTrainingAction } from './individual-training';
import { createMatchMediaActions, finishPendingConversation } from './match-media-actions';
import {
  defaultTrainingCenter,
  trainingDay,
  reserveTrainingMatch,
} from '@dugout/shared/training-center';
import { trainingCenterAction, prepareDailyTraining, recordDailyTraining } from './training-center';
import { developPlayers, developmentReports } from './player-development';

import { autoPitching, preparePitching, nextStarter } from '@dugout/shared/pitching';
import {
  prepareDynamics,
  postNews,
  matchMorale,
  dailyReports,
  dynamicsAction,
} from './club-dynamics';
import { createTransferMarket } from './transfer-market';
import { createCalendarView, prepareCalendar, gameDate, addDays } from '@dugout/shared/calendar';
import {
  PRESEASON_DAYS,
  describePreseasonSkipBlockers,
  preseasonSkipBlockers,
} from '@dugout/shared/preseason';
import type { Coach, GameState, Pos, Result, WorldCatalog } from '@dugout/shared/types';
import { rememberCoaches, releaseCoach } from './coach-employment';
import {
  blankStats,
  rng,
  overall,
  money,
  teamBudget,
  lineupAuto,
  coachRoles,
  coachSkill,
  createGameView,
} from '@dugout/shared/game-view';
import { createPlayerGenerator } from './player-generator';
import {
  autoDefense,
  defaults,
  defenseFor,
  firstTeam,
  preseasonFixtures,
} from '@dugout/shared/management';
import {
  prepareSquad,
  managementAction,
  canRemove,
  developSquad,
  developTrainingFamiliarity,
} from './squad-management';
import { releasePlayer } from './player-release';
export function createGameEngine(world: WorldCatalog) {
  const {
    clubs,
    leagues,
    getClub,
    getLeague,
    baseRoster,
    coachPool,
    rosterFor,
    standings,
    nextFixture,
  } = createGameView(world);
  const { makePlayer } = createPlayerGenerator(world);
  const calendar = createCalendarView(world);
  const transfers = createTransferMarket(world);
  const trades = createTrades(world);
  const rookieDraft = createRookieDraft(world);
  const recruitment = createRecruitment(world);
  const scouting = createScouting(world);
  const managerCareer = createManagerCareer(world);
  const worldSimulation = createWorldSimulation(world);
  const registrations = createAiRegistrations(world);
  const international = createInternational(world);
  const lineupReports = createLineupReports(world);
  const mediaAction = createMatchMediaActions(world);
  const { negotiate, signDeal } = recruitment;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const news = postNews;
  const simulateMatch = createMatchSimulator(world);
  const liveAction = createLiveMatchActions(world, simulateMatch, advance);
  const progression = createCalendarProgression(nextFixture, advance);
  function newGame(
    club: string,
    manager: string,
    mode: 'short' | 'full',
    seed = Date.now(),
    options: {
      firstSeasonTransferBan?: boolean;
      revealPotential?: boolean;
      unemployed?: boolean;
      /** Default true: the career opens four weeks before the league's first fixture. */
      preseason?: boolean;
    } = {},
  ): GameState {
    if (!getClub(club)) throw new Error('구단을 선택해 주세요.');
    const league = getClub(club).league;
    const preseason = options.preseason !== false;
    const roster = structuredClone(baseRoster(club));
    const n = clubs.filter((c) => c.league === league).length;
    const g: GameState = {
      version: 1,
      year: world.year,
      day: preseason ? -PRESEASON_DAYS : 0,
      club,
      manager:
        manager.trim().slice(0, 24) ||
        (!options.unemployed && getClub(club).manager?.name) ||
        '신임 감독',
      budget: teamBudget(league),
      seed: seed >>> 0,
      rounds:
        mode === 'short'
          ? (n % 2 ? n : n - 1) * 2
          : Math.ceil(getLeague(league).games / (n % 2 ? (n - 1) / n : 1)),
      mode,
      roster,
      lineup: lineupAuto(roster),
      starter: roster.filter((p) => p.pos === 'P').sort((a, b) => overall(b) - overall(a))[0].id,
      tactic: 'balanced',
      training: 'balanced',
      trainingCenter: defaultTrainingCenter(),
      staff: coachPool()
        .filter((c) => c.id.endsWith('-0'))
        .map((c) => ({ ...c, id: `${c.id}-${club}` })),
      standings: Object.fromEntries(
        leagues.map((l) => [
          l.id,
          clubs
            .filter((c) => c.league === l.id)
            .map((c) => ({ club: c.id, w: 0, l: 0, d: 0, rf: 0, ra: 0, form: [] })),
        ]),
      ),
      history: [],
      news: [],
      deals: [],
      ownership: {},
      transferred: [],
      past: [],
      phase: preseason ? 'preseason' : 'regular',
      rules: {
        firstSeasonTransferBan: !!options.firstSeasonTransferBan,
        startYear: world.year,
        preseason,
        revealPotential: options.revealPotential === true,
      },
      catalogVersion: world.version,
      series: [],
      champion: '',
      reputation: getLeague(league).level,
      income: 0,
      expenses: 0,
      worldRevenue: {},
    };
    prepareCalendar(g, world, true);
    prepareSquad(g, world);
    prepareKnowledge(g, world);
    prepareWorld(g);
    // A new career has no manager-selected starter to preserve. Recommend the full plan.
    g.pitching = autoPitching(firstTeam(g));
    g.starter = g.pitching.rotation[0];
    g.defense!.P = g.starter;
    prepareDynamics(g);
    const realStaff = coachPool().filter((c) => c.real && c.sourceClub === club);
    if (realStaff.length)
      g.staff = coachRoles.map((role, i) => ({ ...realStaff[i % realStaff.length], role }));
    if (options.unemployed)
      g.managerCareer = {
        status: 'unemployed',
        reputation: 60,
        earnings: 0,
        offers: [],
        history: [],
        unemployedSince: gameDate(g),
      };
    managerCareer.prepare(g);
    prepareFinances(g, league);
    news(
      g,
      `${getClub(club).name}, ${g.manager} 감독 선임`,
      preseason
        ? '4주간의 프리시즌이 시작됩니다. 주 1회 연습경기, 2군 육성, 전술 훈련과 계약을 준비하세요.'
        : '정규시즌 개막일에 취임합니다. 프리시즌 없이 개막전 타순과 선발 로테이션을 바로 확인하세요.',
    );
    news(g, scoutingGuide.title, scoutingGuide.body, 'scout', { actionView: 'scouting' });
    dailyReports(g, world);
    lineupReports.prepare(g);
    if (options.unemployed) {
      g.managerCareer = {
        status: 'unemployed',
        reputation: 60,
        earnings: 0,
        offers: [],
        history: [],
        unemployedSince: gameDate(g),
      };
      g.news = [];
      g.media = undefined;
      news(
        g,
        '무직 감독으로 커리어 시작',
        `${getLeague(league).name}에 친숙한 감독으로 ${preseason ? '개막 4주 전부터' : '정규시즌 개막일부터'} 시작합니다. 감독 채용 현황에서 공석 또는 신임도 35% 미만 구단에 지원해 주세요. 무직 기간에는 급여가 없습니다.`,
        'manager',
        { actionView: 'jobs' },
      );
    }
    international.tick(g);
    return g;
  }
  function teamStrength(g: GameState, id: string) {
    const r = rosterFor(g, id).filter((p) => p.squad !== 'reserve' && isAvailable(p));
    return r.reduce((s, p) => s + overall(p), 0) / (r.length || 1);
  }
  function doMatch(
    g: GameState,
    home: string,
    away: string,
    random: () => number,
    post = false,
  ): Result {
    const live = g.liveMatch,
      matching = live && live.home === home && live.away === away;
    const appearances = new Map(g.roster.map((p) => [p.id, p.stats.g]));
    if (matching && live.prepared && live.timeline) {
      const result = applyMatchEffects(g);
      if (g.phase !== 'preseason' && !post) recordBoardAppearances(g, appearances);
      return result;
    }
    const iterator = simulateMatch(g, home, away, matching ? rng(live.seed) : random, post);
    const result = runMatch(iterator);
    if (g.phase !== 'preseason' && !post) recordBoardAppearances(g, appearances);
    if (matching) delete g.liveMatch;
    return result;
  }
  function record(g: GameState, res: Result, league: string) {
    for (const side of [0, 1]) {
      const id = side ? res.home : res.away;
      const s = g.standings[league].find((s) => s.club === id)!;
      const runs = side ? res.homeScore : res.awayScore,
        against = side ? res.awayScore : res.homeScore;
      const letter = runs === against ? 'D' : runs > against ? 'W' : 'L';
      s.rf += runs;
      s.ra += against;
      if (letter === 'W') s.w++;
      else if (letter === 'L') s.l++;
      else s.d++;
      s.form = [...s.form, letter].slice(-5);
    }
  }
  function scheduledGames(g: GameState, r: () => number, pauseAfterOwn = false) {
    for (const l of leagues) {
      for (const fixture of calendar.onDate(g, l.id)) {
        const { home, away } = fixture;
        if (g.worldResults?.some((m) => m.fixtureId === fixture.id && m.date === fixture.date))
          continue;
        if ((home === g.club || away === g.club) && g.phase !== 'regular') continue;
        registrations.prepare(g, home);
        registrations.prepare(g, away);
        const involved = home === g.club || away === g.club;
        let res: Result;
        if (involved) {
          res = doMatch(g, home, away, r);
        } else {
          const a = teamStrength(g, home),
            b = teamStrength(g, away);
          const poisson = (mean: number) => {
            let p = 1,
              k = 0;
            do {
              k++;
              p *= r();
            } while (p > Math.exp(-mean) && k < 30);
            return k - 1;
          };
          let hs = poisson(clamp(4.2 + (a - b) * 0.08, 1, 8)),
            as = poisson(clamp(4 + (b - a) * 0.08, 1, 8));
          if (hs === as && r() < 0.8) {
            if (r() < 0.5) hs++;
            else as++;
          }
          res = {
            id: `${g.year}-${g.day}-${home}`,
            day: g.day,
            home,
            away,
            homeScore: hs,
            awayScore: as,
            innings: [],
            hits: [],
            errors: [],
            log: [],
            mvp: '',
          };
        }
        res.id = `${g.year}-${fixture.id}`;
        res.fixtureId = fixture.id;
        res.date = fixture.date;
        g.worldResults = [
          { ...res, log: [], replayTeams: undefined },
          ...(g.worldResults || []),
        ].slice(0, 450);
        record(g, res, l.id);
        worldSimulation.recordGame(g, res);
        g.worldRevenue ??= {};
        for (const club of [home, away]) {
          const won = club === home ? res.homeScore > res.awayScore : res.awayScore > res.homeScore;
          g.worldRevenue[club] =
            (g.worldRevenue[club] || 0) +
            teamBudget(l.id) * (club === home ? 0.02 : 0.004) * (won ? 1.15 : 1);
        }
        if (involved) {
          afterMatch(g, res);
          if (pauseAfterOwn && nextFixture(g)) return true;
        }
      }
    }
  }
  function advance(g: GameState, count = 1, pauseAfterOwn = false) {
    international.tick(g);
    prepareSquad(g, world);
    if (g.phase === 'finished') throw new Error('시즌이 종료됐습니다. 다음 시즌을 시작해 주세요.');
    const r = rng(g.seed);
    for (let n = 0; n < clamp(count, 1, 14) && g.phase !== 'finished'; n++) {
      const ownLeague = getClub(g.club).league;
      const trainingDate = gameDate(g);
      const firstMatch =
        !!nextFixture(g) ||
        g.history.some(
          (m) =>
            (m.date || gameDate(g, m.day)) === trainingDate &&
            (m.home === g.club || m.away === g.club),
        );
      const previousMatch = g.history.some(
        (m) =>
          (m.date || gameDate(g, m.day)) === addDays(trainingDate, -1) &&
          (m.home === g.club || m.away === g.club),
      );
      const reserveMatch = reserveTrainingMatch(g);
      const pendingBefore = g.news.filter((n) => n.choiceKind && !n.choice).length;
      if (scheduledGames(g, r, pauseAfterOwn)) return g;
      if (g.phase === 'preseason') {
        const fixture = preseasonFixtures(g, world).find((f) => f.day === g.day);
        if (fixture) {
          const stats = g.roster.map((p) => [p.id, structuredClone(p.stats)] as const);
          const res = doMatch(g, fixture.pair[0], fixture.pair[1], r);
          res.friendly = true;
          for (const [id, saved] of stats) g.roster.find((p) => p.id === id)!.stats = saved;
          afterMatch(g, res);
        }
      } else if (g.phase === 'regular') {
        // Scheduled fixtures were processed for all leagues on this calendar date.
      } else {
        const target = g.phase === 'semifinal' ? 2 : 3;
        for (const s of g.series) {
          if (s.aw >= target || s.bw >= target) continue;
          const [home, away] = (s.aw + s.bw) % 2 ? [s.b, s.a] : [s.a, s.b];
          const res = doMatch(g, home, away, r, true);
          const winner = res.homeScore > res.awayScore ? home : away;
          if (winner === s.a) s.aw++;
          else s.bw++;
          if (home === g.club || away === g.club) afterMatch(g, res);
        }
        if (g.series.every((s) => s.aw >= target || s.bw >= target)) {
          const winners = g.series.map((s) => (s.aw >= target ? s.a : s.b));
          if (g.phase === 'semifinal') {
            g.phase = 'final';
            g.series = [{ a: winners[0], b: winners[1], aw: 0, bw: 0 }];
            news(
              g,
              '챔피언십 대진 확정',
              `${getClub(winners[0]).name} vs ${getClub(winners[1]).name} · 5전 3선승제`,
              'league',
            );
          } else {
            g.phase = 'finished';
            g.champion = winners[0];
            const rank = standings(g).findIndex((s) => s.club === g.club) + 1;
            const own = g.standings[ownLeague].find((s) => s.club === g.club)!;
            g.past.push({ year: g.year, rank, w: own.w, l: own.l, champion: g.champion });
            const prize =
              g.champion === g.club ? teamBudget(ownLeague) * 0.25 : teamBudget(ownLeague) * 0.04;
            g.budget += prize;
            g.income += prize;
            g.reputation = clamp(
              g.reputation + (g.champion === g.club ? 4 : rank <= 4 ? 2 : -1),
              40,
              99,
            );
            news(
              g,
              `${getClub(g.champion).name}, 시즌 우승!`,
              `${g.year} 시즌이 끝났습니다. 상금 ${money(prize)}이 입금됐습니다.`,
              'league',
            );
          }
        }
      }
      developSquad(
        g,
        r,
        clubs.filter((c) => c.league === ownLeague && c.id !== g.club).map((c) => c.id),
        true,
      );
      const training = prepareDailyTraining(g, {
        first: trainingDay(g, 'first', trainingDate, firstMatch, previousMatch),
        reserve: trainingDay(
          g,
          'reserve',
          trainingDate,
          reserveMatch,
          reserveTrainingMatch(g, g.day - 1),
        ),
      });
      developTrainingFamiliarity(g, training);
      developPlayers(g, training);
      recordDailyTraining(g, training);
      g.day++;
      for (const p of g.roster) {
        if (p.internationalDuty) continue;
        p.condition = clamp(
          p.condition + 4 + coachSkill(g, '체력') * 0.09 + (training.get(p.id)?.recovery || 0),
          20,
          100,
        );
      }
      settleClubDay(g, ownLeague);
      prepareSeasonRest(g);
      // Rest dates retain the selected starter; afterMatch rotates only after an appearance.
      dailyReports(g, world, training);
      transfers.offerTick(g);
      recruitment.tick(g);
      trades.tick(g);
      scouting.tick(g);
      developmentReports(g);
      coachReports(g);
      worldSimulation.tick(g);
      medicalTick(g, training);
      managerCareer.tick(g);
      international.tick(g);
      lineupReports.prepare(g);
      if (g.phase === 'preseason' && g.day === 0) {
        g.phase = 'regular';
        news(
          g,
          '정규시즌 개막',
          '연습경기 성적은 정규시즌 기록에 포함되지 않습니다. 개막전 타순과 수비 배치를 확인하세요.',
          'league',
        );
        break;
      }
      if (g.phase === 'regular' && g.day >= g.rounds) {
        const ranked = standings(g),
          top = ranked.slice(0, 4);
        const rank = ranked.findIndex((s) => s.club === g.club) + 1;
        const qualified = top.some((s) => s.club === g.club);
        g.phase = 'semifinal';
        g.series = [
          { a: top[0].club, b: top[3].club, aw: 0, bw: 0 },
          { a: top[1].club, b: top[2].club, aw: 0, bw: 0 },
        ];
        prepareSeasonRest(g);
        news(
          g,
          qualified ? '포스트시즌 진출' : `정규시즌 종료 · ${rank}위`,
          `${getClub(g.club).name}는 정규시즌 ${rank}위로 ${qualified ? '포스트시즌에 진출했습니다.' : '포스트시즌에 진출하지 못했습니다. 우리 팀 경기는 끝났으며 다른 구단의 포스트시즌이 진행됩니다.'} 진출 구단: ${top.map((s) => getClub(s.club).name).join(', ')}. 현재 게임 규칙은 상위 4개 구단의 3전 2선승 준결승과 5전 3선승 결승입니다.`,
          'league',
        );
        break;
      }
      if (g.news.filter((n) => n.choiceKind && !n.choice).length > pendingBefore) break;
    }
    g.seed = Math.floor(r() * 4294967295);
    return g;
  }
  function afterMatch(g: GameState, res: Result) {
    nextStarter(g, true);
    matchMorale(g, res);
    g.history.unshift(res);
    g.history = g.history.slice(0, 180);
    const home = res.home === g.club;
    const own = home ? res.homeScore : res.awayScore,
      opp = home ? res.awayScore : res.homeScore;
    const earned =
      teamBudget(getClub(g.club).league) *
      (home ? 0.02 : 0.004) *
      (own > opp ? 1.15 : 1) *
      (res.friendly ? 0.25 : 1);
    g.budget += earned;
    g.income += earned;
    news(
      g,
      `${res.friendly ? '연습경기 · ' : ''}${own === opp ? '무승부' : own > opp ? '승리' : '패배'} · ${getClub(res.away).short} ${res.awayScore} : ${res.homeScore} ${getClub(res.home).short}`,
      `경기 MVP ${res.mvp} · 경기 수입 ${money(earned)}`,
      'match',
      {
        sender: { name: '수석 코치', role: '경기 후 보고' },
        matchId: res.id,
        actionView: 'squad',
        report: {
          facts: [
            { label: '안타', value: `${res.hits[home ? 1 : 0]}개` },
            { label: '실책', value: `${res.errors[home ? 1 : 0]}개` },
            { label: '경기 MVP', value: res.mvp },
            { label: '경기 수입', value: money(earned) },
          ],
          sections: [
            {
              title: '경기 평가',
              body:
                own > opp
                  ? '승리를 거뒀습니다. 다음 경기 선발과 오늘 등판한 불펜의 컨디션을 점검해 좋은 흐름을 이어가세요.'
                  : own === opp
                    ? '승부를 가리지 못했습니다. 득점 기회에서의 결과와 투수진의 피로를 함께 점검하세요.'
                    : '패배했습니다. 주요 실점 이닝과 수비 배치를 복기하고 다음 경기의 선발·불펜 운용을 준비하세요.',
            },
          ],
        },
      },
    );
  }
  function sellPlayer(g: GameState, id: string, offerId?: string) {
    const p = g.roster.find((p) => p.id === id);
    if (!p) throw new Error('선수를 찾을 수 없습니다.');
    canRemove(g, p);
    if (g.roster.length <= 20) throw new Error('선수단은 최소 20명이 필요합니다.');
    const same = g.roster.filter((v) => v.pos === p.pos).length;
    const min = { P: 5, C: 1, IF: 4, OF: 3, DH: 0 }[p.pos];
    if (same <= min) throw new Error(`${p.pos} 포지션 선수가 부족해 매각할 수 없습니다.`);
    const offer = g.saleOffers?.find(
      (o) => o.id === offerId && o.playerId === id && o.year === g.year && o.expires >= g.day,
    );
    if (!offer) throw new Error('유효한 구단 영입 제안이 필요합니다. 먼저 이적 명단에 등록하세요.');
    if (transfers.closed(g, g.club) || transfers.closed(g, offer.club))
      throw new Error('구단 간 이적 마감 이후입니다.');
    const fee = offer.fee;
    if (g.simulation) archivePlayer(g, p, 'transfer', [], offer.club);
    g.budget += fee;
    g.income += fee;
    const dest = getClub(offer.club);
    g.saleOffers = (g.saleOffers || []).filter((o) => o.playerId !== id);
    if (g.transferListed) delete g.transferListed[id];
    g.ownership[p.id] = dest.id;
    g.transferred = (g.transferred || []).filter((v) => v.id !== p.id);
    g.transferred.push({ ...p, club: dest.id });
    g.roster = g.roster.filter((v) => v.id !== id);
    g.lineup = lineupAuto(firstTeam(g));
    g.defense = autoDefense(g);
    if (g.starter === id) g.starter = firstTeam(g).find((p) => p.pos === 'P')!.id;
    g.defense = autoDefense(g);
    g.deals = g.deals.filter((d) => d.player.id !== id);
    news(
      g,
      `${p.name} 이적 완료`,
      `${getClub(dest.id).name}으로 이적 · 수입 ${money(fee)}`,
      'transfer',
    );
    return g;
  }
  function nextSeason(g: GameState) {
    if (g.phase !== 'finished') throw new Error('현재 시즌을 먼저 마쳐 주세요.');
    if (g.draft?.status === 'open') rookieDraft.progress(g, true);
    worldSimulation.finishSeason(g);
    for (const offer of g.managerCareer?.offers || [])
      if (['invited', 'pending', 'interview', 'offered'].includes(offer.status)) {
        offer.status = 'expired';
        offer.message = '새 시즌으로 넘어가 이전 채용 절차가 종료됐습니다.';
      }
    g.year++;
    for (const center of [
      g.trainingCenter,
      ...Object.values(g.clubCareers || {}).map((c) => c.trainingCenter),
    ]) {
      if (!center) continue;
      center.tally = undefined;
      center.lastDay = undefined;
      for (const program of Object.values(center.programs)) program.days = {};
    }
    const departed: string[] = [];
    for (const [club, saved] of Object.entries(g.clubCareers || {})) {
      const gap = g.year - saved.year;
      if (gap <= 0) continue;
      for (const p of g.simulation ? [] : g.transferred.filter((p) => p.club === club)) {
        p.age += gap;
        p.years = Math.max(1, p.years - gap);
        p.stats = blankStats();
        p.reserveStats = blankStats();
        p.condition = 100;
      }
      saved.year = g.year;
      saved.finances = undefined;
      saved.income = teamBudget(getClub(club).league) * 0.55;
      saved.expenses = 0;
      saved.budget += saved.income;
      saved.reserve = undefined;
    }
    for (const job of Object.values(g.managerJobs || {})) {
      job.startWins = 0;
      job.startLosses = 0;
      job.baseConfidence = job.confidence;
    }
    for (const p of g.roster) {
      p.age++;
      p.years--;
      p.condition = 100;
      if (p.mood) {
        p.mood.recent = [];
        p.mood.promise = undefined;
        p.mood.lastConcernDay = undefined;
        p.mood.lastPlayedDay = undefined;
        p.mood.reason = '새 시즌 준비';
      }
      p.stats = blankStats();
      p.reserveStats = blankStats();
      if (p.years <= 0) departed.push(p.id);
    }
    g.transferred = [
      ...(g.transferred || []),
      ...g.roster.filter((p) => p.years <= 0).map((p) => ({ ...p, club: 'fa', years: 1 })),
    ];
    g.roster = g.roster.filter((p) => p.years > 0);
    for (const id of departed) g.ownership[id] = 'fa';
    let i = 0;
    for (const [pos, min] of [
      ['P', 7],
      ['C', 2],
      ['IF', 6],
      ['OF', 4],
      ['DH', 1],
    ] as [Pos, number][]) {
      while (g.roster.filter((p) => p.pos === pos).length < min) {
        const p = makePlayer(g.club, 400 + i++, undefined, g.year);
        p.pos = pos;
        if (pos === 'P') {
          p.stuff = p.contact;
          p.control = p.field;
        }
        g.roster.push(p);
      }
    }
    g.draft = undefined;
    g.trades = [];
    for (const p of g.roster)
      if (!world.players.some((base) => base.id === p.id)) saveWorldPlayer(g, p, true);
    g.lineup = lineupAuto(g.roster);
    g.starter = g.roster.find((p) => p.pos === 'P')!.id;
    g.calendar = undefined;
    g.day = g.rules?.preseason ? -PRESEASON_DAYS : 0;
    prepareCalendar(g, world, true);
    g.phase = g.rules?.preseason ? 'preseason' : 'regular';
    // A new opening roster must not retain last season's retired/departed registration IDs.
    if (g.registrations) g.registrations.clubs = {};
    for (const p of g.roster) if (p.injury && p.injury.returnDate <= gameDate(g)) delete p.injury;
    g.reserve = undefined;
    prepareSquad(g, world);
    prepareKnowledge(g, world);
    g.series = [];
    g.champion = '';
    g.history = [];
    g.worldResults = [];
    g.worldRevenue = {};
    g.saleOffers = [];
    g.transferListed = {};
    g.deals = [];
    g.coachDeals = [];
    g.coachRecommendations = [];
    const expiredStaff = g.staff.filter(
      (c) => c.contractUntil !== undefined && c.contractUntil <= g.year,
    );
    for (const coach of expiredStaff) releaseCoach(g, coach);
    g.staff = g.staff.filter((c) => !expiredStaff.includes(c));
    if (expiredStaff.length)
      news(
        g,
        '코치 계약 만료',
        expiredStaff.map((c) => `${c.name} (${c.role})`).join(', ') +
          ' · 공석 보직을 확인해 주세요.',
        'contract',
        { actionView: 'staff' },
      );
    g.budget += teamBudget(getClub(g.club).league) * 0.55;
    g.income = teamBudget(getClub(g.club).league) * 0.55;
    g.expenses = 0;
    prepareFinances(g, getClub(g.club).league);
    resetBoardBaseline(g);
    for (const l of leagues)
      for (const s of g.standings[l.id])
        Object.assign(s, { w: 0, l: 0, d: 0, rf: 0, ra: 0, form: [] });
    news(
      g,
      `${g.year} 시즌 시작`,
      `${departed.length}명 계약 만료. 베테랑 은퇴와 노쇠화가 반영됐습니다. 신인 선발에서 새 유망주를 지명하세요.`,
      'league',
    );
    international.tick(g);
    return g;
  }
  /**
   * Delegate the rest of an existing preseason to the coaching staff and stop on opening day.
   * Every calendar day still runs: friendlies, wages, injury recovery, other leagues' results.
   * The manager's own contract, interview and sale decisions are never expired or accepted
   * silently: the command refuses while any wait, and stops as soon as a new one arrives.
   */
  function skipPreseason(g: GameState, a: Record<string, unknown>) {
    if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
    if (g.phase !== 'preseason')
      throw new Error('프리시즌 중에만 남은 기간을 코치에게 맡기고 개막으로 넘어갈 수 있습니다.');
    if (!Number.isInteger(g.day) || g.day < -PRESEASON_DAYS || g.day >= 0)
      throw new Error('프리시즌 날짜를 확인해 주세요.');
    if (a.futureSeasons !== undefined && typeof a.futureSeasons !== 'boolean')
      throw new Error('다음 시즌 프리시즌 진행 여부를 확인해 주세요.');
    const waiting = preseasonSkipBlockers(g);
    if (waiting.length)
      throw new Error(
        `답변을 기다리는 제안이 있어 개막으로 넘어갈 수 없습니다: ${describePreseasonSkipBlockers(waiting)}. 먼저 처리하거나 거절해 주세요.`,
      );
    const from = g.day,
      friendliesBefore = g.history.filter((r) => r.friendly).length,
      before = new Set(g.news.map((n) => n.id));
    let interrupted = false;
    while (g.phase === 'preseason') {
      const previousDay = g.day;
      // Player conversations are delegated to the coaching staff, as during a vacation.
      for (const n of g.news)
        if (n.choiceKind && !n.choice)
          dynamicsAction(g, { type: 'respondNews', id: n.id, choice: 'explain' });
      finishPendingConversation(g);
      g.media = undefined;
      advance(g, 1);
      if (g.day <= previousDay)
        throw new Error('프리시즌 날짜가 진행되지 않았습니다. 현재 일정을 확인해 주세요.');
      if (
        preseasonSkipBlockers(g).length ||
        g.news.some((n) => !before.has(n.id) && n.managerOfferId)
      ) {
        interrupted = g.phase === 'preseason';
        break;
      }
    }
    if (a.futureSeasons === true)
      g.rules = {
        firstSeasonTransferBan: false,
        startYear: g.rules?.startYear ?? g.year,
        ...g.rules,
        preseason: false,
      };
    const friendlies = g.history.filter((r) => r.friendly).length - friendliesBefore;
    news(
      g,
      interrupted ? '프리시즌 위임 중단 · 확인할 연락 도착' : '프리시즌 위임 완료 · 개막 준비',
      `${g.day - from}일을 코치진에게 맡겨 진행했습니다. 연습경기 ${friendlies}회는 코치가 지휘했고 선수 면담은 코치가 대신 답했습니다.${
        interrupted
          ? ' 감독의 답변이 필요한 연락이 도착해 개막 전에 멈췄습니다. 처리한 뒤 다시 개막으로 넘어갈 수 있습니다.'
          : a.futureSeasons === true
            ? ' 다음 시즌부터는 프리시즌 없이 개막일에 시작합니다.'
            : ''
      }`,
      'club',
      interrupted ? undefined : { actionView: 'squad' },
    );
    g.progress = {
      from,
      to: g.day,
      stop: interrupted ? 'report' : 'season',
      newsIds: g.news.filter((n) => !before.has(n.id)).map((n) => n.id),
    };
    return g;
  }
  function applyAction(g: GameState, a: Record<string, unknown>) {
    const s =
      g.liveMatch?.prepared && ['stepMatch', 'matchCursor'].includes(String(a.type))
        ? { ...g, liveMatch: { ...g.liveMatch } }
        : structuredClone(g);
    const readIds = pendingReadIds(a);
    for (const message of s.news) if (readIds.has(message.id)) message.read = true;
    if (!s.liveMatch) {
      international.tick(s);
      prepareSquad(s, world);
      prepareDynamics(s);
      preparePitching(s);
      repairMedicalSelection(s);
      prepareSeasonRest(s);
    }
    prepareKnowledge(s, world);
    if (!s.liveMatch) prepareWorld(s);
    managerCareer.prepare(s);
    lineupReports.prepare(s);
    if (s.draft?.status === 'open' && ['resignManager', 'signManager'].includes(String(a.type)))
      rookieDraft.progress(s, true);
    const careerAction = managerCareer.action(s, a);
    if (careerAction) {
      international.sync(careerAction);
      repairMedicalSelection(careerAction);
      return careerAction;
    }
    if (
      a.type === 'managerContinue' ||
      ((isUnemployed(s) || s.managerCareer!.vacationUntil) &&
        ['continue', 'continueDay', 'advance', 'nextSeason'].includes(String(a.type)))
    ) {
      if (s.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
      const count = a.count === undefined ? 1 : Number(a.count);
      if (!Number.isInteger(count) || count < 1 || count > 7)
        throw new Error('1~7일씩 진행할 수 있습니다.');
      if (!isUnemployed(s) && !s.managerCareer!.vacationUntil && s.phase !== 'finished')
        throw new Error('휴가·무직 기간 또는 시즌 종료 후 사용할 수 있습니다.');
      const from = s.day,
        before = new Set(s.news.map((n) => n.id));
      const startedOnVacation = !!s.managerCareer!.vacationUntil;
      if (a.type === 'nextSeason') {
        nextSeason(s);
        managerCareer.tick(s);
        s.progress = {
          from,
          to: s.day,
          stop: 'season',
          newsIds: s.news.filter((n) => !before.has(n.id)).map((n) => n.id),
        };
        return s;
      }
      for (let i = 0; i < count; i++) {
        if (s.phase === 'finished') {
          const nextOpening = calendar.opening(
            { ...s, year: s.year + 1, calendar: undefined },
            getClub(s.club).league,
          );
          if (
            addDays(gameDate(s), 1) >=
            addDays(nextOpening, s.rules?.preseason ? -PRESEASON_DAYS : 0)
          ) {
            nextSeason(s);
            medicalTick(s);
            managerCareer.tick(s);
            break;
          }
          const random = rng(s.seed);
          scheduledGames(s, random);
          s.seed = Math.floor(random() * 4294967295);
          s.day++;
          international.tick(s);
          worldSimulation.tick(s);
          trades.tick(s);
          scouting.tick(s);
          medicalTick(s);
          managerCareer.tick(s);
          if (
            !s.managerCareer!.vacationUntil &&
            s.news.some((n) => !before.has(n.id) && n.managerOfferId)
          )
            break;
          if (startedOnVacation && !s.managerCareer!.vacationUntil) break;
          continue;
        }
        const vacation = !!s.managerCareer!.vacationUntil;
        for (const n of s.news)
          if (n.choiceKind && !n.choice)
            dynamicsAction(s, { type: 'respondNews', id: n.id, choice: 'explain' });
        s.media = undefined;
        advance(s, 1);
        if (isUnemployed(s))
          s.news = s.news.filter(
            (n) => before.has(n.id) || n.kind === 'manager' || n.kind === 'league',
          );
        if (vacation && !s.managerCareer!.vacationUntil) break;
        if (
          !s.managerCareer!.vacationUntil &&
          s.news.some((n) => !before.has(n.id) && n.managerOfferId)
        )
          break;
      }
      s.progress = {
        from,
        to: s.day,
        stop: s.managerCareer!.vacationUntil ? null : 'report',
        newsIds: s.managerCareer!.vacationUntil
          ? []
          : s.news
              .filter((n) => (startedOnVacation ? !n.read : !before.has(n.id)))
              .map((n) => n.id),
      };
      return s;
    }
    if (isUnemployed(s) && !['readNews', 'readAllNews'].includes(String(a.type)))
      throw new Error('무직 기간에는 구단을 운영할 수 없습니다. 감독 채용에서 계약해 주세요.');
    if (s.managerCareer!.vacationUntil && !['readNews', 'readAllNews'].includes(String(a.type)))
      throw new Error('휴가에서 복귀한 뒤 구단을 운영해 주세요.');
    if (a.type === 'hireRetiredCoach') {
      if (s.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
      const coach = a.retiredCandidate as Coach | undefined;
      const role = String(a.role);
      if (!coach || coach.id !== `retired-${a.playerId}` || !coachRoles.includes(role))
        throw new Error('은퇴 선수 기록과 담당 보직을 확인해 주세요.');
      if (s.staff.some((c) => c.id === coach.id))
        throw new Error('이미 코치진에 합류한 선수입니다.');
      const previous = s.staff.find((c) => c.role === role);
      const compensation = previous ? previous.salary * 0.5 : 0;
      if (s.budget < compensation) throw new Error('기존 코치 계약 정산 예산이 부족합니다.');
      rememberCoaches(s);
      if (previous) releaseCoach(s, previous);
      s.staff = [
        ...s.staff.filter((c) => c.role !== role),
        { ...coach, role, contractUntil: s.year + 2 },
      ];
      rememberCoaches(s);
      s.budget -= compensation;
      s.expenses += compensation;
      news(
        s,
        `${coach.name} 코치 선임`,
        `${role} 코치로 2년 계약했습니다. 연봉 ${money(coach.salary)} · 교체 정산 ${money(compensation)}.`,
        'staff',
      );
      return s;
    }
    const live = liveAction(s, a);
    if (live) return live;
    const nationalAction = international.action(s, a);
    if (nationalAction) return nationalAction;
    const medical = medicalAction(s, a);
    if (medical) return medical;
    const media = mediaAction(s, a);
    if (media) return media;
    if (
      ['continue', 'continueDay', 'advance', 'nextSeason', 'skipPreseason'].includes(String(a.type))
    )
      finishPendingConversation(s);
    const social = dynamicsAction(s, a);
    if (social) return social;
    const traded = trades.action(s, a);
    if (traded) return traded;
    const drafted = rookieDraft.action(s, a);
    if (drafted) return drafted;
    const recruited = recruitment.action(s, a);
    if (recruited) return recruited;
    const scouted = scouting.action(s, a);
    if (scouted) return scouted;
    const lineupReport = lineupReports.action(s, a);
    if (lineupReport) return lineupReport;
    const reportAction = coachReportAction(s, a);
    if (reportAction) return reportAction;
    const trained = individualTrainingAction(s, a);
    if (trained) return trained;
    const teamTraining = trainingCenterAction(s, a);
    if (teamTraining) return teamTraining;
    const managed = managementAction(s, a);
    if (managed) return managed;
    switch (a.type) {
      case 'continue':
        return progression.untilEvent(s);
      case 'continueDay':
        return progression.step(s, a.simulateGames === true);
      case 'advance':
        return advance(s, Number(a.count) || 1);
      case 'auto':
        s.lineup = lineupAuto(firstTeam(s).filter(isAvailable));
        s.defense = autoDefense(s);
        return s;
      case 'lineup': {
        const ids = a.ids as string[];
        if (
          !Array.isArray(ids) ||
          ids.length !== 9 ||
          new Set(ids).size !== 9 ||
          ids.some(
            (id) => !firstTeam(s).some((p) => p.id === id && p.pos !== 'P' && isAvailable(p)),
          )
        )
          throw new Error('타순에는 서로 다른 타자 9명이 필요합니다.');
        s.lineup = ids;
        s.defense = defenseFor(s);
        return s;
      }
      case 'starter':
        if (!firstTeam(s).some((p) => p.id === a.id && p.pos === 'P' && isAvailable(p)))
          throw new Error('투수를 선택해 주세요.');
        managementAction(s, { type: 'pitchingRole', id: a.id, role: 'starter' });
        s.starter = String(a.id);
        s.pitching!.next = s.pitching!.rotation.indexOf(s.starter);
        if (s.defense) s.defense.P = s.starter;
        return s;
      case 'tactic':
        if (!['balanced', 'power', 'smallball', 'patient'].includes(String(a.value)))
          throw new Error('전술을 확인해 주세요.');
        s.tactic = String(a.value);
        s.instructions = defaults(s.tactic);
        s.tacticFamiliarity = Math.max(20, (s.tacticFamiliarity || 55) - 10);
        return s;
      case 'negotiate':
        return negotiate(
          s,
          String(a.id),
          Number(a.salary),
          Number(a.years),
          a.renew ? 'renew' : 'buy',
          a.fee === undefined ? undefined : Number(a.fee),
        );
      case 'sign':
        return signDeal(s, String(a.id));
      case 'listPlayer':
        return transfers.list(s, String(a.id), a.value !== false);
      case 'declineSale':
        s.saleOffers = (s.saleOffers || []).filter((o) => o.id !== a.id);
        return s;
      case 'sell':
        return sellPlayer(s, String(a.id), String(a.offerId || ''));
      case 'releasePlayer':
        return releasePlayer(s, a);
      case 'nextSeason':
        return nextSeason(s);
      case 'skipPreseason':
        return skipPreseason(s, a);
      default:
        throw new Error('지원하지 않는 요청입니다.');
    }
  }
  return {
    newGame,
    applyAction,
    advance,
    nextSeason,
    skipPreseason,
    negotiate,
    signDeal,
    sellPlayer,
    assessSeller: transfers.assess,
  };
}
