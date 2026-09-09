import type { GameState, WorldCatalog } from '@dugout/shared/types';
import type { ClubCareer, ManagerOffer } from '@dugout/shared/manager-career';
import { isUnemployed, managerJobOpen } from '@dugout/shared/manager-career';
import { addDays, gameDate, createCalendarView, daysBetween } from '@dugout/shared/calendar';
import {
  createGameView,
  teamBudget,
  money,
  hash,
  lineupAuto,
  coachRoles,
} from '@dugout/shared/game-view';
import { autoDefense, firstTeam } from '@dugout/shared/management';
import { autoPitching } from '@dugout/shared/pitching';
import { prepareSquad } from './squad-management';
import { prepareKnowledge } from './scouting';
import { postNews, prepareDynamics } from './club-dynamics';
import { annualPayroll } from '@dugout/shared/club-finance';
import { prepareFinances, settleClubDay } from './club-finance';

export function createManagerCareer(world: WorldCatalog) {
  const view = createGameView(world),
    calendar = createCalendarView(world);
  const count = (club: string) =>
    world.clubs.filter((c) => c.league === view.getClub(club).league).length;
  const salary = (club: string, rank: number) =>
    Math.round(
      teamBudget(view.getClub(club).league) *
        (0.012 + ((count(club) - rank) / count(club)) * 0.018),
    );
  function prepare(g: GameState) {
    const firstContract = !g.managerCareer;
    g.managerJobs ??= {};
    for (const c of world.clubs) {
      const table = (g.standings[c.league] ??= []);
      if (!table.some((s) => s.club === c.id))
        table.push({ club: c.id, w: 0, l: 0, d: 0, rf: 0, ra: 0, form: [] });
      const confidence = 25 + (hash(`${c.id}:${g.year}:board`) % 65);
      const row = g.standings[c.league]?.find((s) => s.club === c.id);
      g.managerJobs[c.id] ??= {
        club: c.id,
        managerName: `${c.short} 현 감독`,
        confidence,
        baseConfidence: confidence,
        vacant: false,
        reason: confidence < 35 ? '구단 운영 방향에 대한 이견' : '구단 운영 평가 중',
        appointed: gameDate(g),
        startWins: row?.w || 0,
        startLosses: row?.l || 0,
      };
    }
    g.managerCareer ??= {
      status: 'employed',
      reputation: g.reputation,
      earnings: 0,
      offers: [],
      history: [],
      contract: {
        club: g.club,
        salary: salary(g.club, Math.ceil(count(g.club) / 2)),
        targetRank: Math.ceil(count(g.club) / 2),
        signed: gameDate(g),
        throughYear: g.year,
      },
    };
    if (!isUnemployed(g)) {
      const job = g.managerJobs[g.club];
      if (firstContract)
        Object.assign(job, { confidence: 65, baseConfidence: 65, reason: '신임 감독 취임' });
      job.managerName = g.manager;
      job.vacant = false;
    }
  }
  function report(g: GameState, title: string, body: string) {
    postNews(g, title, body, 'manager', {
      actionView: 'manager',
      sender: { name: '구단주 사무실', role: '감독 경력·계약' },
    });
  }
  function leave(g: GameState, reason: 'resigned' | 'sacked') {
    const m = g.managerCareer!,
      contract = m.contract!;
    m.history.unshift({
      club: g.club,
      from: contract.signed,
      to: gameDate(g),
      reason,
      rank: view.standings(g).findIndex((s) => s.club === g.club) + 1,
    });
    const job = g.managerJobs![g.club];
    job.vacant = true;
    job.managerName = '공석';
    job.confidence = 0;
    job.reason = reason === 'resigned' ? '감독 사퇴' : '구단주 계약 종료';
    m.status = 'unemployed';
    m.unemployedSince = gameDate(g);
    delete m.contract;
    delete m.vacationUntil;
    g.deals = [];
    g.coachDeals = [];
    g.saleOffers = [];
    g.media = undefined;
    for (const n of g.news)
      if (n.choiceKind && !n.choice) {
        n.choice = 'departed';
        n.response = '감독 퇴임으로 구단에 인계했습니다.';
      }
    for (const task of g.scouting?.assignments || [])
      if (task.status === 'active') {
        task.status = 'cancelled';
        delete task.candidateIds;
      }
    report(
      g,
      reason === 'resigned' ? '감독직에서 사퇴했습니다' : '구단주가 감독 계약을 종료했습니다',
      '현재 무직입니다. 감독 채용에 지원하고 제안을 받은 뒤 계약하면 해당 구단의 시즌을 이어갑니다. 무직 기간에는 감독 급여가 지급되지 않습니다.',
    );
  }
  function review(g: GameState) {
    prepare(g);
    const m = g.managerCareer!,
      c = m.contract;
    if (isUnemployed(g) || !c || c.reviewedYear === g.year || g.phase !== 'finished') return;
    const rank = view.standings(g).findIndex((s) => s.club === g.club) + 1;
    c.reviewedYear = g.year;
    if (rank > c.targetRank) {
      m.reputation = Math.max(20, m.reputation - 6);
      report(
        g,
        '시즌 목표 미달',
        `합의한 ${c.targetRank}위 이내 목표에 대해 정규시즌 ${rank}위를 기록했습니다.`,
      );
      leave(g, 'sacked');
    } else {
      c.salary = Math.round(c.salary * 1.15 * 100) / 100;
      c.throughYear = g.year + 1;
      m.reputation = Math.min(99, m.reputation + 4);
      report(
        g,
        '목표 달성 · 연봉 인상과 재계약',
        `정규시즌 ${rank}위로 ${c.targetRank}위 이내 목표를 달성했습니다. 연봉을 15% 인상해 ${money(c.salary)}, ${c.throughYear}시즌까지 계약을 연장합니다.`,
      );
    }
  }
  function tick(g: GameState) {
    prepare(g);
    const m = g.managerCareer!,
      today = gameDate(g);
    for (const job of Object.values(g.managerJobs!)) {
      if (job.vacant) continue;
      const row = g.standings[view.getClub(job.club).league].find((s) => s.club === job.club)!;
      const wins = Math.max(0, row.w - job.startWins),
        losses = Math.max(0, row.l - job.startLosses);
      const targetPressure =
        job.club === g.club && m.contract
          ? Math.max(0, Math.ceil(count(g.club) / 2) - m.contract.targetRank)
          : 1;
      job.confidence = Math.max(
        0,
        Math.min(
          100,
          Math.round(job.baseConfidence + wins * 1.5 - losses * (1.5 + targetPressure * 0.3)),
        ),
      );
      job.reason =
        job.confidence < 35
          ? '성적과 운영 방향에 대한 구단주 불만'
          : job.confidence >= 70
            ? '성적과 운영 방향에 신뢰'
            : '성적과 운영 방향을 평가 중';
      if (wins + losses >= 10 && job.confidence < 15) {
        if (job.club === g.club && !isUnemployed(g)) {
          m.reputation = Math.max(20, m.reputation - 5);
          leave(g, 'sacked');
        } else {
          job.vacant = true;
          job.managerName = '공석';
          job.reason = '신임도 하락으로 감독 해임';
        }
      }
    }
    for (const offer of m.offers) {
      if (['pending', 'offered'].includes(offer.status) && offer.expires < today) {
        offer.status = 'expired';
        offer.message = '제안 유효기간이 지나 채용 심사가 종료됐습니다.';
      } else if (offer.status === 'pending' && offer.due <= today) {
        const level = view.getLeague(view.getClub(offer.club).league).level;
        const accepted = managerJobOpen(g.managerJobs![offer.club]) && m.reputation >= level - 18;
        offer.status = accepted ? 'offered' : 'rejected';
        offer.message = accepted
          ? `연봉 ${money(offer.salary)} · 목표 ${offer.targetRank}위 이내. 계약서에 서명하면 취임합니다.`
          : '현 감독의 신임도가 회복됐거나 구단이 요구하는 감독 평판에 미치지 못해 지원이 거절됐습니다.';
        report(
          g,
          `${view.getClub(offer.club).name} · ${accepted ? '감독 계약 제안' : '지원 결과'}`,
          offer.message,
        );
      }
    }
    if (m.vacationUntil && today >= m.vacationUntil) {
      delete m.vacationUntil;
      report(g, '휴가에서 복귀했습니다', '코치에게 위임한 경기와 선수단 보고를 확인해 주세요.');
    }
    archiveTick(g);
    review(g);
  }
  function archiveTick(g: GameState) {
    for (const [club, saved] of Object.entries(g.clubCareers || {})) {
      const state: GameState = {
        ...g,
        ...saved,
        club,
        managerCareer: undefined,
        roster: view.rosterFor(g, club),
      };
      settleClubDay(state, view.getClub(club).league);
      for (const res of (g.worldResults || []).filter(
        (r) => r.date === gameDate(g, g.day - 1) && (r.home === club || r.away === club),
      )) {
        const home = res.home === club,
          win = home ? res.homeScore > res.awayScore : res.awayScore > res.homeScore;
        const earned =
          teamBudget(view.getClub(club).league) * (home ? 0.02 : 0.004) * (win ? 1.15 : 1);
        state.budget += earned;
        state.income += earned;
      }
      Object.assign(saved, {
        budget: state.budget,
        income: state.income,
        expenses: state.expenses,
        finances: state.finances,
      });
    }
  }
  function snapshot(g: GameState): ClubCareer {
    return structuredClone({
      year: g.year,
      rounds: g.rounds,
      budget: g.budget,
      income: g.income,
      expenses: g.expenses,
      staff: g.staff,
      lineup: g.lineup,
      starter: g.starter,
      tactic: g.tactic,
      training: g.training,
      defense: g.defense,
      pitching: g.pitching,
      instructions: g.instructions,
      tacticBook: g.tacticBook,
      tacticFamiliarity: g.tacticFamiliarity,
      reserve: g.reserve,
      reputation: g.reputation,
      finances: g.finances,
    });
  }
  function join(g: GameState, offer: ManagerOffer) {
    const previous = g.club;
    const date = gameDate(g);
    if (previous !== offer.club) {
      g.clubCareers ??= {};
      g.clubCareers[previous] = snapshot(g);
      const outgoing = g.roster.map((p) => ({ ...p, club: previous }));
      for (const p of outgoing) g.ownership[p.id] = previous;
      g.transferred = [
        ...g.transferred.filter((p) => !outgoing.some((x) => x.id === p.id)),
        ...outgoing,
      ];
      const roster = structuredClone(view.rosterFor(g, offer.club));
      const saved = g.clubCareers[offer.club];
      const realStaff = view.coachPool().filter((c) => c.real && c.sourceClub === offer.club);
      const baseline = saved || {
        budget: teamBudget(view.getClub(offer.club).league),
        income: 0,
        expenses: 0,
        staff: realStaff.length
          ? coachRoles.map((role, i) => ({ ...realStaff[i % realStaff.length], role }))
          : view.coachPool().filter((c) => c.id.endsWith('-0')),
        tactic: 'balanced',
        training: 'balanced',
        reputation: view.getLeague(view.getClub(offer.club).league).level,
      };
      for (const [key, value] of Object.entries(baseline))
        if (key !== 'year') Object.assign(g, { [key]: value });
      g.club = offer.club;
      g.roster = roster;
      g.transferred = g.transferred.filter((p) => p.club !== g.club);
      for (const p of roster) g.ownership[p.id] = g.club;
      // World date and standings never reset on employment. Local selections are restored where possible.
      g.day = daysBetween(g.calendar!.openingDate, date);
      g.deals = [];
      g.coachDeals = [];
      g.saleOffers = [];
      g.transferListed = {};
      g.media = undefined;
      g.coachRecommendations = [];
      if (!saved) {
        g.lineup = lineupAuto(roster);
        g.starter = roster.find((p) => p.pos === 'P')!.id;
        g.pitching = undefined;
        g.defense = undefined;
        g.reserve = undefined;
        g.instructions = undefined;
        g.tacticBook = undefined;
        g.tacticFamiliarity = 55;
        g.finances = undefined;
      }
      prepareSquad(g, world);
      prepareDynamics(g);
      if (!saved) {
        g.pitching = autoPitching(firstTeam(g));
        g.starter = g.pitching.rotation[0];
        g.defense = autoDefense(g);
      }
      const league = view.getClub(g.club).league;
      const last = calendar.fixtures(g, league).at(-1);
      if (last) g.rounds = daysBetween(g.calendar!.openingDate, last.date) + 1;
      g.phase = g.day < 0 ? 'preseason' : g.day >= g.rounds ? 'finished' : 'regular';
      g.series = [];
      g.champion = '';
      prepareFinances(g, league);
      if (!saved) {
        const fixtures = calendar.fixtures(g, league);
        const firstDate = fixtures[0]?.date || gameDate(g);
        const lastDate = fixtures.at(-1)?.date || firstDate;
        const days = daysBetween(firstDate, lastDate) + 1 + 28 + 8;
        const elapsed = Math.max(0, Math.min(days, daysBetween(addDays(firstDate, -28), date)));
        g.finances!.days = days;
        g.finances!.settledDays = elapsed;
        g.finances!.paidWages =
          (annualPayroll({ ...g, managerCareer: undefined }) * elapsed) / days;
        g.finances!.receivedSupport = (g.finances!.annualSupport * elapsed) / days;
        g.expenses = g.finances!.paidWages;
        g.income = g.finances!.receivedSupport + (g.worldRevenue?.[g.club] || 0);
        g.budget = teamBudget(league) + g.income - g.expenses;
      }
      delete g.clubCareers[g.club];
    }
    const m = g.managerCareer!;
    const job = g.managerJobs![g.club];
    const row = g.standings[view.getClub(g.club).league].find((s) => s.club === g.club)!;
    Object.assign(job, {
      managerName: g.manager,
      vacant: false,
      confidence: 65,
      baseConfidence: 65,
      reason: '신임 감독 취임',
      appointed: date,
      startWins: row.w,
      startLosses: row.l,
    });
    m.status = 'employed';
    m.contract = {
      club: g.club,
      salary: offer.salary,
      targetRank: offer.targetRank,
      signed: date,
      throughYear: g.year,
      ...(g.phase === 'finished' ? { reviewedYear: g.year, throughYear: g.year + 1 } : {}),
    };
    delete m.unemployedSince;
    m.offers = [];
    prepareKnowledge(g, world);
    const league = view.getClub(g.club).league;
    if (!g.knowledge!.leagues.includes(league)) g.knowledge!.leagues.push(league);
    prepareKnowledge(g, world);
    report(
      g,
      `${view.getClub(g.club).name} 감독으로 취임`,
      `${offer.targetRank}위 이내 · 연봉 ${money(offer.salary)}에 계약했습니다. 기존 리그 순위와 구단 선수단을 이어받았습니다.`,
    );
  }
  function action(g: GameState, a: Record<string, unknown>): GameState | null {
    if (
      ![
        'resignManager',
        'managerTarget',
        'applyManager',
        'signManager',
        'startVacation',
        'endVacation',
      ].includes(String(a.type))
    )
      return null;
    prepare(g);
    const m = g.managerCareer!;
    if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
    if (a.type === 'resignManager') {
      if (isUnemployed(g)) throw new Error('현재 소속 구단이 없습니다.');
      if (a.confirm !== true) throw new Error('감독 사퇴를 확인해 주세요.');
      leave(g, 'resigned');
    } else if (a.type === 'startVacation') {
      if (isUnemployed(g)) throw new Error('취업 후 휴가를 사용할 수 있습니다.');
      const days = Number(a.days);
      if (!Number.isInteger(days) || days < 1 || days > 28)
        throw new Error('휴가는 1~28일로 선택해 주세요.');
      if (m.vacationUntil) throw new Error('이미 휴가 중입니다.');
      m.vacationUntil = addDays(gameDate(g), days);
      g.media = undefined;
      report(
        g,
        '휴가 · 코치에게 경기 위임',
        `${m.vacationUntil}까지 휴가입니다. 휴가 진행을 누르면 날짜와 경기가 진행됩니다. 구단주 목표 평가는 계속 적용됩니다.`,
      );
    } else if (a.type === 'endVacation') {
      if (!m.vacationUntil) throw new Error('현재 휴가 중이 아닙니다.');
      delete m.vacationUntil;
      report(g, '휴가 조기 복귀', '오늘부터 직접 구단을 지휘합니다.');
    } else if (a.type === 'signManager') {
      const offer = m.offers.find((o) => o.id === a.id);
      if (!isUnemployed(g) || !offer || offer.status !== 'offered' || offer.expires < gameDate(g))
        throw new Error('유효한 감독 계약 제안이 없습니다.');
      if (g.phase === 'semifinal' || g.phase === 'final')
        throw new Error('포스트시즌을 마친 뒤 취임할 수 있습니다.');
      if (!managerJobOpen(g.managerJobs![offer.club]))
        throw new Error('현 감독의 신임도가 회복되어 채용이 종료됐습니다.');
      join(g, offer);
    } else {
      const club = a.type === 'managerTarget' ? g.club : String(a.club);
      if (!world.clubs.some((c) => c.id === club)) throw new Error('지원할 구단을 선택해 주세요.');
      const target = Number(a.targetRank),
        max = Math.ceil(count(club) * 0.75);
      if (!Number.isInteger(target) || target < 1 || target > max)
        throw new Error(`구단주는 1~${max}위 이내 목표를 협의합니다.`);
      if (a.type === 'managerTarget') {
        if (isUnemployed(g) || !m.contract) throw new Error('현재 소속 구단이 없습니다.');
        if (g.day >= 0 && m.contract.signed !== gameDate(g))
          throw new Error('시즌 목표는 개막 전 또는 취임 당일에만 변경할 수 있습니다.');
        m.contract.targetRank = target;
        m.contract.salary = salary(club, target);
        report(
          g,
          '구단주와 시즌 목표 합의',
          `정규시즌 ${target}위 이내 · 연봉 ${money(m.contract.salary)}. 목표 달성 시 15% 인상과 계약 연장, 미달 시 해고됩니다.`,
        );
      } else {
        if (!isUnemployed(g))
          throw new Error('사퇴 또는 계약 종료 후 감독직에 지원할 수 있습니다.');
        if (!managerJobOpen(g.managerJobs![club]))
          throw new Error('공석이거나 구단주 신임도 35% 미만인 팀에만 지원할 수 있습니다.');
        const active = m.offers.filter((o) => ['pending', 'offered'].includes(o.status));
        if (active.length >= 3 || active.some((o) => o.club === club))
          throw new Error('동시에 최대 세 구단에 한 번씩 지원할 수 있습니다.');
        if (m.offers.some((o) => o.club === club && daysBetween(o.applied, gameDate(g)) < 14))
          throw new Error('같은 구단에는 14일 뒤 다시 지원할 수 있습니다.');
        const today = gameDate(g);
        m.offers.unshift({
          id: `manager-${club}-${today}-${hash(g.manager)}`,
          club,
          targetRank: target,
          salary: salary(club, target),
          applied: today,
          due: addDays(today, 3),
          expires: addDays(today, 17),
          status: 'pending',
          message: '구단이 지원서를 검토합니다. 3일 뒤 답변 예정입니다.',
        });
        m.offers = m.offers.slice(0, 30);
        report(
          g,
          `${view.getClub(club).name} 감독직 지원`,
          '제안한 순위 목표와 감독 평판을 검토한 뒤 답변합니다.',
        );
      }
    }
    return g;
  }
  return { prepare, action, tick, review };
}
