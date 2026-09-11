import { reconcileManagerPeople, availableManager } from './manager-people';
import { clubExpectation, clubStrengthRanks } from '@dugout/shared/club-expectations';
import { approachValuation, clubNegotiationBudget, updateBoardTrust } from './manager-valuation';
import { isClubDutyReport } from '@dugout/shared/employment-reports';
import { rememberRegistration } from './registration-log';
import { rememberCoaches } from './coach-employment';
import { prepareManagerTerms, tickManagerTerms } from './manager-contracts';
import { managerConversationAction } from './manager-conversation';
import { isManagerConversationCommand } from '@dugout/shared/manager-commands';
import { createPlayerGenerator } from './player-generator';
import { boardAction, boardFailure } from './board-objectives';
import type { GameState, WorldCatalog } from '@dugout/shared/types';
import type { ClubCareer, ManagerOffer } from '@dugout/shared/manager-career';
import { isUnemployed, managerJobOpen } from '@dugout/shared/manager-career';
import { addDays, gameDate, createCalendarView, daysBetween } from '@dugout/shared/calendar';
import {
  createGameView,
  teamBudget,
  money,
  hash,
  rng,
  lineupAuto,
  initialCoachRoles,
} from '@dugout/shared/game-view';
import { autoDefense, firstTeam } from '@dugout/shared/management';
import { autoPitching } from '@dugout/shared/pitching';
import { prepareSquad } from './squad-management';
import { prepareKnowledge } from './scouting';
import { postNews, prepareDynamics } from './club-dynamics';
import { annualPayroll } from '@dugout/shared/club-finance';
import { prepareFinances, settleClubDay, reviewFinances } from './club-finance';
import { saveWorldPlayer, worldEvent } from './world-simulation';

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
  const generator = createPlayerGenerator(world);
  const generatedManager = (club: string, stamp: string) =>
    generator.generatedName(
      view.getLeague(view.getClub(club).league).country,
      rng(hash(club + stamp)),
    );
  function prepare(g: GameState) {
    if (
      !isUnemployed(g) &&
      !g.managerCareer?.history.length &&
      ['신임 감독', '감독'].includes(g.manager) &&
      view.getClub(g.club).manager
    )
      g.manager = view.getClub(g.club).manager!.name;
    if (isUnemployed(g)) {
      for (const n of g.news)
        if (isClubDutyReport(n)) {
          n.employmentClosed = true;
          n.read = true;
        }
    }
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
        managerName: c.manager?.name || `${generatedManager(c.id, 'initial')} (가상)`,
        confidence,
        baseConfidence: confidence,
        vacant: false,
        reason: confidence < 35 ? '구단 운영 방향에 대한 이견' : '구단 운영 평가 중',
        appointed: gameDate(g),
        startWins: row?.w || 0,
        startLosses: row?.l || 0,
        startDraws: row?.d || 0,
      };
      const job = g.managerJobs[c.id];
      if (!job.vacant && /현 감독$/.test(job.managerName))
        job.managerName = c.manager?.name || `${generatedManager(c.id, 'initial')} (가상)`;
    }
    if (Object.values(g.managerJobs).some((job) => job.expectation?.year !== g.year)) {
      const ranks = clubStrengthRanks(world.clubs, (club) => view.rosterFor(g, club));
      for (const job of Object.values(g.managerJobs)) {
        if (job.expectation?.year === g.year) continue;
        const previousRank = job.board?.year === g.year - 1 ? job.board.rank : undefined;
        job.expectation = {
          ...clubExpectation(ranks[job.club], count(job.club), previousRank),
          year: g.year,
        };
        if (job.board && job.board.year !== g.year) {
          job.baseConfidence = Math.max(35, Math.min(85, job.confidence));
          job.startWins = 0;
          job.startLosses = 0;
          job.startDraws = 0;
          delete job.board;
        }
      }
    }
    g.managerCareer ??= {
      status: 'employed',
      reputation: g.reputation,
      earnings: 0,
      offers: [],
      history: [],
      contract: {
        club: g.club,
        salary: salary(g.club, g.managerJobs[g.club].expectation!.targetRank),
        targetRank: g.managerJobs[g.club].expectation!.targetRank,
        signed: gameDate(g),
        throughYear: g.year,
      },
    };
    for (const offer of g.managerCareer.offers) {
      if (
        offer.expectation ||
        !['invited', 'pending', 'interview', 'offered'].includes(offer.status)
      )
        continue;
      const expectation = g.managerJobs[offer.club]?.expectation;
      if (!expectation) continue;
      offer.expectation = expectation;
      const budget = clubNegotiationBudget(
        g,
        offer.club,
        salary(offer.club, expectation.targetRank),
        teamBudget(view.getClub(offer.club).league),
      );
      // Keep promises made by an older save, while giving untouched invitations current valuations.
      budget.salary = Math.max(budget.salary, offer.salary, offer.contractTerms?.salary || 0);
      budget.signingBonus = Math.max(
        budget.signingBonus,
        offer.signingBonus || 0,
        offer.contractTerms?.signingBonus || 0,
      );
      budget.years = Math.max(budget.years, offer.contractTerms?.years || 1);
      budget.total = Math.round((budget.salary * budget.years + budget.signingBonus) * 100) / 100;
      offer.negotiationBudget ??= budget;
      if (
        offer.source === 'approach' &&
        offer.status === 'invited' &&
        !offer.contractTerms &&
        !offer.interview?.length
      ) {
        const valuation = approachValuation(
          g,
          salary(offer.club, expectation.targetRank),
          offer.negotiationBudget,
        );
        offer.salary = Math.max(offer.salary, valuation.salary);
        offer.signingBonus = Math.max(offer.signingBonus || 0, valuation.signingBonus);
        offer.valuation = {
          ...valuation.valuation,
          increasePercent: valuation.valuation.currentSalary
            ? Math.round((offer.salary / valuation.valuation.currentSalary - 1) * 100)
            : 0,
        };
        offer.targetRank = expectation.targetRank;
        offer.message = `${expectation.tier}을 위해 ${offer.targetRank}위 이내를 기대합니다. 연봉 ${money(offer.salary)} · 계약금 ${money(offer.signingBonus)}으로 면접을 제안합니다. ${valuation.valuation.reason}.`;
      }
    }
    if (!isUnemployed(g)) {
      const job = g.managerJobs[g.club];
      if (firstContract)
        Object.assign(job, { confidence: 65, baseConfidence: 65, reason: '신임 감독 취임' });
      job.managerName = g.manager;
      job.vacant = false;
    }
    reconcileManagerPeople(g, world);
  }
  function report(g: GameState, title: string, body: string, offer?: ManagerOffer) {
    postNews(g, title, body, 'manager', {
      actionView: offer ? 'job-offers' : 'manager',
      managerOfferId: offer?.id,
      sender: {
        name: offer ? `${view.getClub(offer.club).name} 이사회` : '구단주 사무실',
        role: offer ? '감독 선임 담당' : '감독 경력·계약',
      },
    });
  }
  function leave(
    g: GameState,
    reason: 'resigned' | 'sacked',
    detail = '감독 본인이 사퇴 의사를 전달했습니다.',
    endKind: 'resignation' | 'nonrenewal' | 'dismissal' = 'resignation',
  ) {
    const m = g.managerCareer!,
      contract = m.contract!;
    m.history.unshift({
      club: g.club,
      from: contract.signed,
      to: gameDate(g),
      reason,
      endKind,
      detail,
      targetRank: contract.targetRank,
      confidence: g.managerJobs![g.club].confidence,
      rank: view.standings(g).findIndex((s) => s.club === g.club) + 1,
    });
    const job = g.managerJobs![g.club];
    job.vacant = true;
    job.managerName = '공석';
    job.confidence = 0;
    job.vacantSince = gameDate(g);
    job.reason = detail;
    m.status = 'unemployed';
    m.unemployedSince = gameDate(g);
    delete m.contract;
    delete m.vacationUntil;
    g.deals = [];
    g.coachDeals = [];
    g.saleOffers = [];
    g.trades = [];
    g.draft = undefined;
    g.media = undefined;
    for (const recommendation of g.coachRecommendations || [])
      if (recommendation.status === 'pending') recommendation.status = 'dismissed';
    for (const player of g.roster) if (player.mood) delete player.mood.promise;
    for (const n of g.news) {
      if (isClubDutyReport(n)) {
        n.employmentClosed = true;
        n.read = true;
      }
      if (n.lineupRecommendation?.status === 'pending') n.lineupRecommendation.status = 'dismissed';
      if (n.choiceKind && !n.choice) {
        n.choice = 'departed';
        n.response = '감독 퇴임으로 구단에 인계했습니다.';
      }
    }
    for (const task of g.scouting?.assignments || [])
      if (task.status === 'active') {
        task.status = 'cancelled';
        delete task.candidateIds;
      }
    report(
      g,
      reason === 'resigned'
        ? '감독직에서 사퇴했습니다'
        : endKind === 'nonrenewal'
          ? '감독 계약 만료 · 재계약하지 않기로 결정했습니다'
          : '구단주가 감독을 경질했습니다',
      `${view.getClub(g.club).name} 이사회 결정: ${detail}\n현재 무직입니다. 감독 채용에 지원하고 제안을 받은 뒤 계약하면 해당 구단의 시즌을 이어갑니다. 무직 기간에는 감독 급여가 지급되지 않습니다.`,
    );
  }
  function review(g: GameState) {
    prepare(g);
    const m = g.managerCareer!,
      c = m.contract;
    if (isUnemployed(g) || !c || c.reviewedYear === g.year || g.phase !== 'finished') return;
    const rank = view.standings(g).findIndex((s) => s.club === g.club) + 1;
    c.reviewedYear = g.year;
    const failed = boardFailure(g);
    if (rank > c.targetRank || failed) {
      m.reputation = Math.max(20, m.reputation - 6);
      report(
        g,
        '시즌 목표 미달',
        `합의한 ${c.targetRank}위 이내 목표에 대해 정규시즌 ${rank}위를 기록했습니다. ${failed}`,
      );
      const detail = [
        `정규시즌 ${rank}위 · 계약 목표 ${c.targetRank}위 이내${rank > c.targetRank ? ' 미달' : ' 달성'}.`,
        failed,
        `평가 당시 이사회 신뢰도 ${g.managerJobs![g.club].confidence}%.`,
        c.throughYear <= g.year
          ? '계약 기간이 끝나며, 위 평가를 근거로 재계약하지 않습니다.'
          : '계약 기간이 남아 있으나 위 목표 미달을 근거로 감독직을 해임합니다.',
      ]
        .filter(Boolean)
        .join(' ');
      leave(g, 'sacked', detail, c.throughYear <= g.year ? 'nonrenewal' : 'dismissal');
    } else {
      m.reputation = Math.min(99, m.reputation + 4);
      const offer: ManagerOffer = {
        id: `renewal-${g.club}-${g.year}`,
        club: g.club,
        targetRank: c.targetRank,
        salary: Math.round(c.salary * 1.15 * 100) / 100,
        signingBonus: 0,
        source: 'renewal',
        expectation: g.managerJobs![g.club].expectation,
        applied: gameDate(g),
        due: gameDate(g),
        expires: `${g.year + 1}-03-27`,
        status: 'offered',
        message: `정규시즌 ${rank}위로 목표를 달성했습니다. 연봉 15% 인상 조건으로 재계약을 제안합니다. 현재 계약은 바뀌지 않으며, 조건 합의와 감독님의 서명이 있어야 연장됩니다.`,
      };
      prepareManagerTerms(offer);
      m.offers = [offer, ...m.offers.filter((o) => o.id !== offer.id)];
      report(g, '목표 달성 · 감독 재계약 제안', offer.message, offer);
    }
  }
  function tick(g: GameState) {
    prepare(g);
    const m = g.managerCareer!,
      today = gameDate(g);
    if (m.status === 'employed' && m.contract && m.contract.throughYear < g.year)
      leave(
        g,
        'resigned',
        '계약 기간이 끝났으며 감독이 새 계약에 서명하지 않아 퇴임했습니다.',
        'nonrenewal',
      );
    const finance = !isUnemployed(g) ? reviewFinances(g, view.getClub(g.club).league) : undefined;
    for (const job of Object.values(g.managerJobs!)) {
      if (job.vacant) {
        job.vacantSince ??= today;
        const pending = m.offers.some(
          (o) =>
            o.club === job.club &&
            ['invited', 'pending', 'interview', 'offered'].includes(o.status) &&
            o.expires >= today,
        );
        if (!pending && daysBetween(job.vacantSince, today) >= 7) {
          const row = g.standings[view.getClub(job.club).league].find((s) => s.club === job.club)!;
          const candidate = availableManager(g, world, job.club);
          Object.assign(job, {
            vacant: false,
            confidence: 60,
            baseConfidence: 60,
            appointed: today,
            startWins: row.w,
            startLosses: row.l,
            startDraws: row.d,
            managerName: candidate?.name || `${generatedManager(job.club, today)} (가상)`,
            managerId: candidate?.id,
            reason: '공개 채용을 거쳐 새 감독 선임',
          });
          delete job.vacantSince;
          delete job.board;
          worldEvent(g, {
            kind: 'appointment',
            club: job.club,
            text: `${view.getClub(job.club).name} · 새 감독 선임`,
          });
        }
        continue;
      }
      const row = g.standings[view.getClub(job.club).league].find((s) => s.club === job.club)!;
      const wins = Math.max(0, row.w - job.startWins),
        losses = Math.max(0, row.l - job.startLosses);
      const table = view.standings(g, view.getClub(job.club).league);
      updateBoardTrust(job, {
        year: g.year,
        rank: table.findIndex((row) => row.club === job.club) + 1,
        target:
          job.club === g.club && m.contract ? m.contract.targetRank : job.expectation!.targetRank,
        count: count(job.club),
        wins,
        losses,
        draws: Math.max(0, row.d - (job.startDraws || 0)),
        financePenalty: job.club === g.club ? finance?.penalty || 0 : 0,
      });
      if (job.club === g.club && finance?.penalty)
        job.reason = `${finance.status} · ${finance.reasons.join(' · ')} (신뢰도 −${finance.penalty})`;
      if (wins + losses >= 10 && job.confidence < 15) {
        if (job.club === g.club && !isUnemployed(g)) {
          m.reputation = Math.max(20, m.reputation - 5);
          leave(
            g,
            'sacked',
            `취임 후 ${wins}승 ${losses}패 · 이사회 신뢰도 ${job.confidence}%. 10경기 이상 치른 뒤 신뢰도가 해임 기준 15% 미만으로 하락했습니다. ${finance?.penalty ? `재정 평가: ${finance.reasons.join(' · ')} (신뢰도 −${finance.penalty}).` : ''}`,
            'dismissal',
          );
        } else {
          job.vacant = true;
          job.vacantSince = today;
          job.managerName = '공석';
          job.reason = '신임도 하락으로 감독 해임';
        }
      }
    }
    for (const offer of m.offers) {
      if (offer.expires >= today && tickManagerTerms(g, offer))
        report(g, `${view.getClub(offer.club).name} · 계약 협상 답변`, offer.message, offer);
      if (
        ['invited', 'pending', 'interview', 'offered'].includes(offer.status) &&
        offer.expires < today
      ) {
        offer.status = 'expired';
        offer.message = '제안 유효기간이 지나 채용 심사가 종료됐습니다.';
      } else if (offer.status === 'pending' && offer.due <= today) {
        const level = view.getLeague(view.getClub(offer.club).league).level;
        const open = managerJobOpen(g.managerJobs![offer.club]);
        const qualified = m.reputation >= level - 18;
        const needsInterview = !!offer.priority && !offer.answer;
        const score =
          m.reputation +
          (offer.interview?.length
            ? Math.max(
                -15,
                Math.min(
                  20,
                  offer.interview.reduce((sum, t) => sum + t.score, 0),
                ),
              )
            : offer.answer === offer.priority
              ? 8
              : 0);
        const accepted =
          open && qualified && (needsInterview || score >= (offer.rivalScore || level - 18));
        offer.status = accepted ? (needsInterview ? 'interview' : 'offered') : 'rejected';
        offer.message = accepted
          ? needsInterview
            ? `최종 면접 초청 · 경쟁 후보 평가 ${offer.rivalScore}점. 구단은 ${{ win: '즉시 성적', youth: '유망주 육성', budget: '지출 관리' }[offer.priority!]}을 우선합니다. 운영 방향을 설명해 주세요.`
            : `최종 후보 비교를 통과했습니다. 연봉 ${money(offer.salary)} · 계약금 ${money(offer.signingBonus || 0)} · 목표 ${offer.targetRank}위 이내. 조건 합의 후 서명하면 취임합니다.`
          : '현 감독의 신임도 회복, 평판 요건 또는 경쟁 후보 평가에 따라 채용이 종료됐습니다.';
        if (offer.status === 'offered' && offer.interview?.length) prepareManagerTerms(offer);
        report(
          g,
          `${view.getClub(offer.club).name} · ${accepted ? (needsInterview ? '최종 면접 초청' : '감독 계약 제안') : '지원 결과'}`,
          offer.message,
          offer,
        );
      }
    }
    for (const offer of m.offers) {
      if (
        ['invited', 'interview', 'offered'].includes(offer.status) &&
        daysBetween(today, offer.expires) >= 0 &&
        daysBetween(today, offer.expires) <= 2 &&
        offer.reminderDate !== offer.expires
      ) {
        offer.reminderDate = offer.expires;
        report(
          g,
          `${view.getClub(offer.club).name} · 답변 기한 안내`,
          `${offer.expires}까지 답변을 기다립니다. 진행 중인 채용 조건을 확인하거나 제안을 거절해 주십시오.`,
          offer,
        );
      }
    }
    const seeking = isUnemployed(g);
    const approachDue = seeking
      ? daysBetween(m.lastApproach || m.unemployedSince || today, today) >= (m.lastApproach ? 7 : 3)
      : g.day > 0 && g.day % 28 === 0 && m.lastApproach !== today;
    if (
      approachDue &&
      m.offers.filter((o) => ['invited', 'pending', 'interview', 'offered'].includes(o.status))
        .length < 3
    ) {
      const candidates = Object.values(g.managerJobs!).filter(
        (j) =>
          (seeking || j.club !== g.club) &&
          managerJobOpen(j) &&
          m.reputation >= view.getLeague(view.getClub(j.club).league).level - 18 &&
          !m.offers.some((o) => o.club === j.club && daysBetween(o.applied, today) < 28),
      );
      const candidate = candidates
        .sort(
          (a, b) =>
            Number(g.knowledge?.leagues.includes(view.getClub(b.club).league)) -
              Number(g.knowledge?.leagues.includes(view.getClub(a.club).league)) ||
            hash(`${a.club}:${today}`) - hash(`${b.club}:${today}`),
        )
        .find((job) => {
          const base = salary(job.club, job.expectation!.targetRank);
          const cap = clubNegotiationBudget(
            g,
            job.club,
            base,
            teamBudget(view.getClub(job.club).league),
          );
          return seeking || cap.salary >= (m.contract?.salary || 0) * 1.05;
        });
      if (candidate) {
        const targetRank = candidate.expectation!.targetRank;
        const base = salary(candidate.club, targetRank);
        const negotiationBudget = clubNegotiationBudget(
          g,
          candidate.club,
          base,
          teamBudget(view.getClub(candidate.club).league),
        );
        const valuation = approachValuation(g, base, negotiationBudget);
        const priority = (['win', 'youth', 'budget'] as const)[hash(candidate.club) % 3];
        const offer: ManagerOffer = {
          id: `approach-${candidate.club}-${today}`,
          club: candidate.club,
          targetRank,
          ...valuation,
          expectation: candidate.expectation,
          negotiationBudget,
          applied: today,
          due: today,
          expires: addDays(today, 14),
          status: 'invited',
          source: 'approach',
          priority,
          rivalScore: Math.max(40, view.getLeague(view.getClub(candidate.club).league).level - 18),
          message: `${g.manager} 감독님, 우리 구단의 다음 시즌을 함께 이끌어 주실 분을 찾고 있습니다. 감독님의 경력에 관심이 있어 비공개로 연락드립니다. ${valuation.valuation.reason}. 연봉 ${money(valuation.salary)}${valuation.valuation.currentSalary ? ` · 현재보다 ${valuation.valuation.increasePercent}% 인상` : ''} · 계약금 ${money(valuation.signingBonus)}을 제안합니다. 구단은 ${candidate.expectation!.tier}을 위해 ${targetRank}위 이내를 기대합니다. 감독직 면접에 참여하시겠습니까?`,
        };
        m.offers.unshift(offer);
        m.offers = m.offers.slice(0, 30);
        m.lastApproach = today;
        report(
          g,
          `${view.getClub(candidate.club).name} · 감독직에 관심 있으십니까?`,
          offer.message,
          offer,
        );
      }
    }
    if (m.vacationUntil && today >= m.vacationUntil) {
      delete m.vacationUntil;
      report(g, '휴가에서 복귀했습니다', '코치에게 위임한 경기와 선수단 보고를 확인해 주세요.');
    }
    archiveTick(g);
    review(g);
    reconcileManagerPeople(g, world);
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
    rememberRegistration(g);
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
      trainingCenter: g.trainingCenter,
      defense: g.defense,
      pitching: g.pitching,
      instructions: g.instructions,
      tacticBook: g.tacticBook,
      tacticFamiliarity: g.tacticFamiliarity,
      reserve: g.reserve,
      reputation: g.reputation,
      finances: g.finances,
      facilities: g.facilities,
    });
  }
  function join(g: GameState, offer: ManagerOffer) {
    rememberCoaches(g);
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
          ? initialCoachRoles.flatMap((role, i) =>
              realStaff[i] ? [{ ...realStaff[i], role }] : [],
            )
          : view
              .coachPool()
              .filter((c) => c.id.endsWith('-0') && initialCoachRoles.includes(c.role))
              .map((c) => ({ ...c, id: `${c.id}-${offer.club}` })),
        tactic: 'balanced',
        training: 'balanced',
        reputation: view.getLeague(view.getClub(offer.club).league).level,
      };
      for (const [key, value] of Object.entries(baseline))
        if (key !== 'year') Object.assign(g, { [key]: value });
      g.club = offer.club;
      g.staff = g.staff.filter((c) => {
        const assigned = g.coachAssignments?.[c.id];
        return (
          !assigned ||
          (assigned.club === offer.club &&
            (assigned.coach.contractUntil === undefined || assigned.coach.contractUntil > g.year))
        );
      });
      rememberCoaches(g);
      g.roster = roster;
      if (g.simulation)
        for (const p of roster)
          saveWorldPlayer(g, p, !world.players.some((base) => base.id === p.id));
      g.transferred = g.transferred.filter((p) => p.club !== g.club);
      for (const p of roster) g.ownership[p.id] = g.club;
      // World date and standings never reset on employment. Local selections are restored where possible.
      g.day = daysBetween(g.calendar!.openingDate, date);
      g.deals = [];
      g.coachDeals = [];
      g.saleOffers = [];
      g.trades = [];
      g.draft = undefined;
      g.transferListed = {};
      g.media = undefined;
      g.coachRecommendations = [];
      g.trainingCenter = saved?.trainingCenter ? structuredClone(saved.trainingCenter) : undefined;
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
      startDraws: row.d,
    });
    delete job.vacantSince;
    delete job.board;
    m.status = 'employed';
    m.contract = {
      club: g.club,
      salary: offer.salary,
      targetRank: offer.targetRank,
      signed: date,
      throughYear: g.year + (offer.contractTerms?.years || 1) - 1,
      ...(g.phase === 'finished'
        ? { reviewedYear: g.year, throughYear: g.year + (offer.contractTerms?.years || 1) }
        : {}),
    };
    delete m.unemployedSince;
    const signingBonus = offer.signingBonus || 0;
    m.contract.signingBonus = signingBonus;
    if (signingBonus > g.budget)
      throw new Error('구단의 현재 잔액으로 계약금을 지급할 수 없습니다.');
    g.budget -= signingBonus;
    g.expenses += signingBonus;
    m.earnings += signingBonus;
    if (offer.budgetAdjustment) {
      const adjustment = Math.round(
        teamBudget(view.getClub(g.club).league) * offer.budgetAdjustment,
      );
      g.budget += adjustment;
      if (adjustment > 0) g.income += adjustment;
      else g.expenses -= adjustment;
    }
    for (const news of g.news)
      if (news.managerOfferId === offer.id) news.contractResolution = 'signed';
    m.offers = [];
    prepareKnowledge(g, world);
    const league = view.getClub(g.club).league;
    if (!g.knowledge!.leagues.includes(league)) g.knowledge!.leagues.push(league);
    prepareKnowledge(g, world);
    report(
      g,
      `${view.getClub(g.club).name} 감독으로 취임`,
      `${offer.targetRank}위 이내 · 연봉 ${money(offer.salary)} · 계약금 ${money(signingBonus)}(체결 시 1회 지급)에 계약했습니다. 기존 리그 순위와 구단 선수단을 이어받았습니다.`,
    );
  }
  function action(g: GameState, a: Record<string, unknown>): GameState | null {
    if (isManagerConversationCommand(a.type)) {
      prepare(g);
      const offer = g.managerCareer?.offers.find((o) => o.id === a.id);
      const club = view.getClub(offer?.club || g.club);
      return managerConversationAction(g, a, {
        name: club.name,
        league: club.league,
        count: count(club.id),
      });
    }
    if (a.type === 'boardNegotiate') {
      prepare(g);
      return boardAction(g, a, world);
    }
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
      if (!offer || offer.status !== 'offered' || offer.expires < gameDate(g))
        throw new Error('유효한 감독 계약 제안이 없습니다.');
      if (offer.contractTerms) {
        const t = offer.contractTerms;
        if (t.status !== 'agreed' || a.termsVersion !== t.version || a.signature !== g.manager)
          throw new Error('계약 조건에 합의한 뒤 최신 계약서에 감독 이름으로 서명해 주세요.');
        offer.salary = t.salary;
        offer.signingBonus = t.signingBonus || 0;
        offer.targetRank = t.targetRank;
      }
      if (g.phase === 'semifinal' || g.phase === 'final')
        throw new Error('포스트시즌을 마친 뒤 취임할 수 있습니다.');
      if (offer.source === 'renewal') {
        if (isUnemployed(g) || offer.club !== g.club || !m.contract)
          throw new Error('현재 소속 구단의 재계약 제안이 아닙니다.');
        const bonus = offer.signingBonus || 0;
        if (g.budget < bonus) throw new Error('계약금 지급 예산이 부족합니다.');
        m.contract = {
          ...m.contract,
          salary: offer.salary,
          signingBonus: bonus,
          targetRank: offer.targetRank,
          signed: gameDate(g),
          throughYear: Math.max(m.contract.throughYear, g.year + (offer.contractTerms?.years || 1)),
        };
        g.budget -= bonus;
        g.expenses += bonus;
        m.earnings += bonus;
        for (const n of g.news) if (n.managerOfferId === offer.id) n.contractResolution = 'signed';
        m.offers = m.offers.filter((o) => o.id !== offer.id);
        report(
          g,
          '감독 재계약 완료',
          `감독님의 서명으로 ${m.contract.throughYear}시즌까지 계약했습니다. 연봉 ${money(offer.salary)} · 계약금 ${money(bonus)}.`,
        );
        return g;
      }
      if (!managerJobOpen(g.managerJobs![offer.club]))
        throw new Error('현 감독의 신임도가 회복되어 채용이 종료됐습니다.');
      if (!isUnemployed(g)) leave(g, 'resigned');
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
        if (g.day >= 0 && target > m.contract.targetRank) {
          report(
            g,
            '이사회 답변 · 시즌 목표 유지',
            '감독님의 의견은 확인했습니다. 시즌 중에는 합의한 순위 목표를 유지하려 합니다. 현재 전력과 성적을 개선할 지원이 필요하다면 추가 지원을 요청해 주십시오.',
          );
          return g;
        }
        if (m.contract.negotiatedYear === g.year && target > m.contract.targetRank)
          throw new Error('추가 지원을 받은 시즌의 순위 약속은 낮출 수 없습니다.');
        m.contract.targetRank = target;
        if (g.day < 0) m.contract.salary = salary(club, target);
        report(
          g,
          '구단주와 시즌 목표 합의',
          `정규시즌 ${target}위 이내 · 연봉 ${money(m.contract.salary)}. 목표 달성 시 재계약 제안을 받으며 감독의 서명 후 연장됩니다. 목표 미달은 계약 평가에 반영됩니다.`,
        );
      } else {
        if (!isUnemployed(g) && club === g.club)
          throw new Error('현재 재직 중인 구단에는 지원할 수 없습니다.');
        if (!managerJobOpen(g.managerJobs![club]))
          throw new Error('공석이거나 구단주 신임도 35% 미만인 팀에만 지원할 수 있습니다.');
        const active = m.offers.filter((o) =>
          ['invited', 'pending', 'interview', 'offered'].includes(o.status),
        );
        if (active.length >= 3 || active.some((o) => o.club === club))
          throw new Error('동시에 최대 세 구단에 한 번씩 지원할 수 있습니다.');
        if (m.offers.some((o) => o.club === club && daysBetween(o.applied, gameDate(g)) < 14))
          throw new Error('같은 구단에는 14일 뒤 다시 지원할 수 있습니다.');
        const today = gameDate(g);
        const expectation = g.managerJobs![club].expectation!;
        const boardTarget = Math.min(target, expectation.targetRank);
        const baseSalary = salary(club, expectation.targetRank);
        const negotiationBudget = clubNegotiationBudget(
          g,
          club,
          baseSalary,
          teamBudget(view.getClub(club).league),
        );
        m.offers.unshift({
          id: `manager-${club}-${today}-${hash(g.manager)}`,
          club,
          targetRank: boardTarget,
          salary: baseSalary,
          signingBonus: Math.min(
            negotiationBudget.signingBonus,
            Math.round(baseSalary * 0.08 * 100) / 100,
          ),
          expectation,
          negotiationBudget,
          applied: today,
          due: addDays(today, 3),
          expires: addDays(today, 17),
          status: 'pending',
          source: 'application',
          public: a.public === true,
          priority: (['win', 'youth', 'budget'] as const)[hash(club) % 3],
          rivalScore: Math.max(
            40,
            view.getLeague(view.getClub(club).league).level - 18 + (hash(club + today) % 6),
          ),
          message: `구단이 지원서를 검토합니다. ${expectation.tier}을 위해 ${boardTarget}위 이내를 기대합니다. 3일 뒤 답변 예정입니다.`,
        });
        m.offers = m.offers.slice(0, 30);
        if (!isUnemployed(g) && a.public === true) {
          const own = g.managerJobs![g.club];
          own.baseConfidence = Math.max(0, own.baseConfidence - 8);
          own.confidence = Math.max(0, own.confidence - 8);
          report(
            g,
            '타 구단 공개 지원 · 신임도 하락',
            '현재 구단주가 공개 지원에 실망했습니다. 신임도 8%p 하락.',
          );
        }
        report(
          g,
          `${view.getClub(club).name} 감독직 지원`,
          a.public === true
            ? '감독직에 대한 공개적인 관심을 구단에 전달했습니다. 구단은 평판과 제안한 목표를 검토한 뒤 3일 안에 연락할 예정입니다.'
            : '비공개 접촉을 전달했습니다. 구단은 외부 발표 없이 경력과 운영 계획을 검토하고 3일 안에 연락합니다.',
          m.offers[0],
        );
      }
    }
    reconcileManagerPeople(g, world);
    return g;
  }
  return { prepare, action, tick, review };
}
