import { createMatchSimulator } from './match-simulation';
import { createLiveMatchActions } from './live-match';
import { applyMatchEffects, runMatch } from './match-timeline';
import { createCalendarProgression } from './calendar-progression';
import { createRecruitment } from './recruitment';
import { createScouting, prepareKnowledge } from './scouting';
import { individualTrainingAction } from './individual-training';
import { createMatchMediaActions, finishPendingConversation } from './match-media-actions';
import { trainingRecovery } from '@dugout/shared/training-plan';
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
import { createCalendarView, prepareCalendar } from '@dugout/shared/calendar';
import type { GameState, Pos, Result, WorldCatalog } from '@dugout/shared/types';
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
import { prepareSquad, managementAction, canRemove, developSquad } from './squad-management';
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
  const recruitment = createRecruitment(world);
  const scouting = createScouting(world);
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
    options: { firstSeasonTransferBan?: boolean; revealPotential?: boolean } = {},
  ): GameState {
    if (!getClub(club)) throw new Error('구단을 선택해 주세요.');
    const league = getClub(club).league;
    const roster = structuredClone(baseRoster(club));
    const n = clubs.filter((c) => c.league === league).length;
    const g: GameState = {
      version: 1,
      year: world.year,
      day: -28,
      club,
      manager: manager.trim().slice(0, 24) || '신임 감독',
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
      staff: coachPool().filter((c) => c.id.endsWith('-0')),
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
      phase: 'preseason',
      rules: {
        firstSeasonTransferBan: !!options.firstSeasonTransferBan,
        startYear: world.year,
        preseason: true,
        revealPotential: options.revealPotential === true,
      },
      catalogVersion: world.version,
      series: [],
      champion: '',
      reputation: getLeague(league).level,
      income: 0,
      expenses: 0,
    };
    prepareKnowledge(g, world);
    prepareCalendar(g, world, true);
    prepareSquad(g, world);
    // A new career has no manager-selected starter to preserve. Recommend the full plan.
    g.pitching = autoPitching(firstTeam(g));
    g.starter = g.pitching.rotation[0];
    g.defense!.P = g.starter;
    prepareDynamics(g);
    const realStaff = coachPool().filter((c) => c.real && c.sourceClub === club);
    if (realStaff.length)
      g.staff = coachRoles.map((role, i) => ({ ...realStaff[i % realStaff.length], role }));
    news(
      g,
      `${getClub(club).name}, ${g.manager} 감독 선임`,
      '4주간의 프리시즌이 시작됩니다. 주 1회 연습경기, 2군 육성, 전술 훈련과 계약을 준비하세요.',
    );
    news(
      g,
      '스카우팅 리포트 도착',
      '세계 선수 시장에서 실명 선수와 가상 유망주를 확인할 수 있습니다. 에이전트에게 계약 조건을 제안하세요.',
      'scout',
    );
    dailyReports(g, world);
    return g;
  }
  function teamStrength(g: GameState, id: string) {
    const r = rosterFor(g, id);
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
    if (matching && live.prepared && live.timeline) return applyMatchEffects(g);
    const iterator = simulateMatch(g, home, away, matching ? rng(live.seed) : random, post);
    const result = runMatch(iterator);
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
        if (involved) {
          afterMatch(g, res);
          if (pauseAfterOwn && nextFixture(g)) return true;
        }
      }
    }
  }
  function advance(g: GameState, count = 1, pauseAfterOwn = false) {
    prepareSquad(g, world);
    if (g.phase === 'finished') throw new Error('시즌이 종료됐습니다. 다음 시즌을 시작해 주세요.');
    const r = rng(g.seed);
    for (let n = 0; n < clamp(count, 1, 14) && g.phase !== 'finished'; n++) {
      const ownLeague = getClub(g.club).league;
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
      );
      developPlayers(g);
      g.day++;
      for (const p of g.roster) {
        p.condition = clamp(
          p.condition +
            4 +
            coachSkill(g, '체력') * 0.09 +
            trainingRecovery(g, p, g.day - 1) +
            (g.training === 'rest' ? 9 : g.training === 'intense' ? -5 : 0),
          20,
          100,
        );
      }
      const salary =
        (g.roster.reduce((s, p) => s + p.salary, 0) + g.staff.reduce((s, c) => s + c.salary, 0)) /
        (g.rounds + (g.rules?.preseason ? 28 : 0));
      g.budget -= salary;
      g.expenses += salary;
      // Rest dates retain the selected starter; afterMatch rotates only after an appearance.
      dailyReports(g, world);
      transfers.offerTick(g);
      recruitment.tick(g);
      scouting.tick(g);
      developmentReports(g);
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
        const top = standings(g).slice(0, 4);
        g.phase = 'semifinal';
        g.series = [
          { a: top[0].club, b: top[3].club, aw: 0, bw: 0 },
          { a: top[1].club, b: top[2].club, aw: 0, bw: 0 },
        ];
        news(
          g,
          '포스트시즌 개막',
          '상위 4개 구단이 3전 2선승 준결승에 진출했습니다. 결승은 5전 3선승입니다.',
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
    g.year++;
    const departed: string[] = [];
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
    const rookies = Array.from({ length: 3 }, (_, i) =>
      makePlayer(g.club, 900 + i, undefined, g.year),
    );
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
    g.roster.push(...rookies.slice(0, 3).filter((p) => !g.roster.some((x) => x.id === p.id)));
    g.lineup = lineupAuto(g.roster);
    g.starter = g.roster.find((p) => p.pos === 'P')!.id;
    g.calendar = undefined;
    g.day = g.rules?.preseason ? -28 : 0;
    prepareCalendar(g, world, true);
    g.phase = g.rules?.preseason ? 'preseason' : 'regular';
    g.reserve = undefined;
    prepareSquad(g, world);
    g.series = [];
    g.champion = '';
    g.history = [];
    g.worldResults = [];
    g.saleOffers = [];
    g.transferListed = {};
    g.deals = [];
    g.coachDeals = [];
    const expiredStaff = g.staff.filter(
      (c) => c.contractUntil !== undefined && c.contractUntil <= g.year,
    );
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
    for (const l of leagues)
      for (const s of g.standings[l.id])
        Object.assign(s, { w: 0, l: 0, d: 0, rf: 0, ra: 0, form: [] });
    news(
      g,
      `${g.year} 시즌 시작`,
      `${departed.length}명 계약 만료. 가상 신인 입단과 베테랑 노쇠화가 반영됐습니다.`,
      'league',
    );
    return g;
  }
  function applyAction(g: GameState, a: Record<string, unknown>) {
    const s =
      g.liveMatch?.prepared && ['stepMatch', 'matchCursor'].includes(String(a.type))
        ? { ...g, liveMatch: { ...g.liveMatch } }
        : structuredClone(g);
    if (!s.liveMatch) {
      prepareSquad(s, world);
      prepareDynamics(s);
      preparePitching(s);
    }
    prepareKnowledge(s, world);
    const live = liveAction(s, a);
    if (live) return live;
    const media = mediaAction(s, a);
    if (media) return media;
    if (['continue', 'continueDay', 'advance', 'nextSeason'].includes(String(a.type)))
      finishPendingConversation(s);
    const social = dynamicsAction(s, a);
    if (social) return social;
    const recruited = recruitment.action(s, a);
    if (recruited) return recruited;
    const scouted = scouting.action(s, a);
    if (scouted) return scouted;
    const trained = individualTrainingAction(s, a);
    if (trained) return trained;
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
        s.lineup = lineupAuto(firstTeam(s));
        s.defense = autoDefense(s);
        return s;
      case 'lineup': {
        const ids = a.ids as string[];
        if (
          !Array.isArray(ids) ||
          ids.length !== 9 ||
          new Set(ids).size !== 9 ||
          ids.some((id) => !firstTeam(s).some((p) => p.id === id && p.pos !== 'P'))
        )
          throw new Error('타순에는 서로 다른 타자 9명이 필요합니다.');
        s.lineup = ids;
        s.defense = defenseFor(s);
        return s;
      }
      case 'starter':
        if (!firstTeam(s).some((p) => p.id === a.id && p.pos === 'P'))
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
      case 'training':
        if (!['balanced', 'power', 'pitching', 'defense', 'rest'].includes(String(a.value)))
          throw new Error('훈련을 확인해 주세요.');
        s.training = String(a.value);
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
      case 'nextSeason':
        return nextSeason(s);
      default:
        throw new Error('지원하지 않는 요청입니다.');
    }
  }
  return {
    newGame,
    applyAction,
    advance,
    nextSeason,
    negotiate,
    signDeal,
    sellPlayer,
    assessSeller: transfers.assess,
  };
}
