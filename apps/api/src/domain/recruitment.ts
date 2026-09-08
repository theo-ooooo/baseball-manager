import type { CoachDeal, Deal, GameState, WorldCatalog } from '@dugout/shared/types';
import {
  blankStats,
  coachRoles,
  createGameView,
  hash,
  money,
  overall,
  askPrice,
} from '@dugout/shared/game-view';
import { transfersBlocked } from '@dugout/shared/management';
import { postNews } from './club-dynamics';
import { createTransferMarket } from './transfer-market';

type Offer = Deal | CoachDeal;
function terms(salary: number, years: number) {
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    salary > 1e8 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 5
  )
    throw new Error('유효한 연봉과 1~5년 계약을 입력해 주세요.');
}
function record(g: GameState, d: Offer, message: string) {
  d.message = message;
  d.history = [
    ...(d.history || []),
    { day: g.day, year: g.year, salary: d.salary, years: d.years, message },
  ].slice(-12);
}
function notify(g: GameState, d: Offer, subject: string) {
  const coach = 'coach' in d;
  postNews(g, `${coach ? d.coach.name : d.player.name} · ${subject}`, d.message, 'transfer', {
    actionView: coach ? 'staff' : 'agents',
    ...(!coach ? { playerId: d.player.id } : {}),
  });
}
function isExpired(g: GameState, d: Offer) {
  return (d.year !== undefined && d.year !== g.year) || g.day > (d.expires ?? d.day + 14);
}
function requireReply(g: GameState, d: Offer | undefined) {
  if (!d || !['accepted', 'counter'].includes(d.status))
    throw new Error('상대의 수락 또는 역제안을 먼저 기다려 주세요.');
  if (isExpired(g, d)) throw new Error('제안 유효기간이 지났습니다. 다시 협상해 주세요.');
}

export function createRecruitment(world: WorldCatalog) {
  const view = createGameView(world),
    market = createTransferMarket(world);
  function negotiate(
    g: GameState,
    id: string,
    salary: number,
    years: number,
    type: 'buy' | 'renew' = 'buy',
    offeredFee?: number,
  ) {
    terms(salary, years);
    if (type === 'buy' && transfersBlocked(g))
      throw new Error('첫 시즌 외부 영입 금지 조건입니다. 재계약·매각·코치 선임은 가능합니다.');
    const p = (type === 'renew' ? g.roster : view.marketPlayers(g)).find((p) => p.id === id);
    if (!p) throw new Error('해당 선수를 찾을 수 없습니다.');
    const previous = g.deals.find((d) => d.player.id === id);
    if (previous?.status === 'pending')
      throw new Error('상대가 제안을 검토 중입니다. 답변을 기다리거나 협상을 철회해 주세요.');
    const keepClubAgreement =
      previous?.stage === 'player' &&
      previous.seller &&
      !isExpired(g, previous) &&
      !['withdrawn', 'expired', 'rejected'].includes(previous.status);
    const fee =
      type === 'renew' || p.club === 'fa'
        ? 0
        : keepClubAgreement
          ? previous!.fee
          : (offeredFee ?? askPrice(p));
    if (!Number.isFinite(fee) || fee < 0 || fee > 1e10)
      throw new Error('유효한 이적료를 입력해 주세요.');
    const stage = type === 'buy' && p.club !== 'fa' && !keepClubAgreement ? 'club' : 'player';
    const d: Deal = {
      id: `deal-${g.year}-${g.day}-${id}-${(previous?.history?.length || 0) + 1}`,
      player: structuredClone(p),
      type,
      salary,
      years,
      fee,
      agentFee: Math.round(salary * view.agentFor(p).fee),
      status: 'pending',
      stage,
      day: g.day,
      year: g.year,
      responseDay: g.day + 1 + (hash(id) % 2),
      message: '',
      history: previous?.history || [],
      seller: keepClubAgreement ? previous!.seller : undefined,
    };
    record(
      g,
      d,
      stage === 'club'
        ? '소속 구단에 이적료를 제안했습니다. 구단이 동의하면 개인 계약 조건을 검토합니다.'
        : '에이전트에게 계약 조건을 보냈습니다. 1~2일 안에 답변이 도착합니다.',
    );
    g.deals = [d, ...g.deals.filter((old) => old.player.id !== id)].slice(0, 30);
    return g;
  }
  function resolvePlayer(g: GameState, d: Deal) {
    const p = (d.type === 'renew' ? g.roster : view.marketPlayers(g)).find(
      (p) => p.id === d.player.id,
    );
    if (!p || p.club !== d.player.club || (d.type === 'buy' && transfersBlocked(g))) {
      d.status = 'rejected';
      record(g, d, '선수 소속 또는 영입 조건이 바뀌어 협상을 진행할 수 없습니다.');
    } else if (d.stage === 'club') {
      d.seller = market.assess(g, p);
      if (d.seller.status === 'refused') {
        d.status = 'rejected';
        record(g, d, d.seller.reason);
      } else if (d.fee < d.seller.fee) {
        d.status = 'counter';
        d.fee = d.seller.fee;
        record(
          g,
          d,
          `소속 구단의 역제안: 이적료 ${money(d.fee)}. 동의하면 선수와 개인 조건을 협상합니다. ${d.seller.reason}`,
        );
      } else {
        d.stage = 'player';
        d.responseDay = g.day + 1;
        record(
          g,
          d,
          '소속 구단이 이적에 동의했습니다. 에이전트가 연봉과 계약 기간을 검토 중입니다.',
        );
      }
    } else {
      const gap = Math.max(0, overall(p) - g.reputation - 4);
      const demand = Math.max(5, Math.round(p.salary * (1.04 + gap * 0.03)));
      const willing = gap < 18 || d.salary >= demand * 1.3;
      d.status =
        d.salary >= demand && (d.years >= 2 || d.salary >= demand * 1.1) && willing
          ? 'accepted'
          : d.salary >= demand * 0.65
            ? 'counter'
            : 'rejected';
      if (d.fee + d.agentFee + d.salary * 0.15 > g.budget) {
        d.status = 'rejected';
        record(g, d, '이적료·계약금·수수료를 감당할 예산이 부족합니다.');
      } else if (d.status === 'counter') {
        d.salary = Math.round(demand * (d.years === 1 ? 1.1 : 1) * (willing ? 1 : 1.3));
        d.years = Math.max(2, d.years);
        d.agentFee = Math.round(d.salary * view.agentFor(p).fee);
        record(
          g,
          d,
          `에이전트의 역제안: 연봉 ${money(d.salary)}, ${d.years}년 계약. 수락하거나 조건을 수정해 주세요.`,
        );
      } else
        record(
          g,
          d,
          d.status === 'accepted'
            ? '선수가 조건에 동의했습니다. 최종 계약을 체결해 주세요.'
            : '선수의 기대 조건에 미치지 못해 제안을 거절했습니다.',
        );
    }
    if (d.status !== 'pending') {
      d.responseDay = undefined;
      d.expires = g.day + 7;
    }
    notify(g, d, d.status === 'pending' ? '구단 합의 · 개인 조건 검토' : '협상 답변 도착');
  }
  function signDeal(g: GameState, id: string) {
    const d = g.deals.find((d) => d.id === id);
    requireReply(g, d);
    if (d!.status !== 'accepted' || d!.stage === 'club')
      throw new Error('개인 조건에 합의한 뒤 최종 계약할 수 있습니다.');
    const deal = d!;
    if (deal.type === 'buy') {
      if (transfersBlocked(g)) throw new Error('첫 시즌에는 외부 선수와 FA를 영입할 수 없습니다.');
      const available = view.marketPlayers(g).find((p) => p.id === deal.player.id);
      if (!available || available.club !== deal.player.club)
        throw new Error('선수 소속이 변경됐습니다. 다시 협상하세요.');
      const seller = market.assess(g, available);
      if (seller.status === 'refused') throw new Error(seller.reason);
      if (deal.fee < seller.fee)
        throw new Error('구단의 요구 이적료가 변경됐습니다. 다시 협상하세요.');
      if (g.roster.length >= 85) throw new Error('선수단 정원 85명입니다. 매각 후 영입해 주세요.');
      if (g.roster.some((p) => p.id === deal.player.id)) throw new Error('이미 소속된 선수입니다.');
    }
    const current =
      deal.type === 'renew' ? g.roster.find((p) => p.id === deal.player.id) : deal.player;
    if (!current) throw new Error('재계약 선수를 찾을 수 없습니다.');
    const cash = deal.fee + deal.agentFee + deal.salary * 0.15;
    if (g.budget < cash) throw new Error('영입 예산이 부족합니다.');
    g.budget -= cash;
    g.expenses += cash;
    const p = {
      ...current,
      club: g.club,
      salary: deal.salary,
      years: deal.years,
      condition: deal.type === 'buy' ? 100 : current.condition,
      stats: deal.type === 'buy' ? blankStats() : current.stats,
    };
    if (deal.type === 'renew') g.roster = g.roster.map((old) => (old.id === p.id ? p : old));
    else {
      p.squad = 'reserve';
      g.roster.push(p);
      g.ownership[p.id] = g.club;
      g.transferred = g.transferred.filter((v) => v.id !== p.id);
    }
    g.deals = g.deals.filter((old) => old.player.id !== p.id);
    postNews(
      g,
      `${p.name} ${deal.type === 'buy' ? '영입' : '재계약'} 완료`,
      `${deal.years}년 · 연봉 ${money(deal.salary)} · 에이전트 ${view.agentFor(p).name}`,
      'transfer',
      { playerId: p.id, actionView: 'squad' },
    );
    return g;
  }
  function coachOffer(g: GameState, a: Record<string, unknown>) {
    const candidate = view.coachPool(g.year).find((c) => c.id === a.id);
    if (!candidate) throw new Error('코치를 찾을 수 없습니다.');
    const role = String(a.role || candidate.role),
      salary = Number(a.salary),
      years = Number(a.years);
    terms(salary, years);
    if (!coachRoles.includes(role) || (!candidate.real && role !== candidate.role))
      throw new Error('코치가 담당할 수 있는 보직을 선택해 주세요.');
    if (g.staff.some((c) => c.id === candidate.id)) throw new Error('이미 선임된 코치입니다.');
    const previous = g.coachDeals?.find((d) => d.coach.id === candidate.id);
    if (previous?.status === 'pending')
      throw new Error('코치가 제안을 검토 중입니다. 답변을 기다려 주세요.');
    const outgoing = g.staff.find((c) => c.role === role);
    const compensation = outgoing?.contractUntil
      ? outgoing.salary * Math.max(0, outgoing.contractUntil - g.year) * 0.25
      : 0;
    const d: CoachDeal = {
      id: `coach-${g.year}-${g.day}-${candidate.id}-${(previous?.history.length || 0) + 1}`,
      coach: structuredClone(candidate),
      role,
      salary,
      years,
      day: g.day,
      year: g.year,
      status: 'pending',
      responseDay: g.day + 1 + (hash(candidate.id) % 2),
      message: '',
      replacesId: outgoing?.id,
      compensation,
      history: previous?.history || [],
    };
    record(g, d, `${role} 코치 보직과 계약 조건을 제안했습니다. 1~2일 안에 답변이 도착합니다.`);
    g.coachDeals = [
      d,
      ...(g.coachDeals || []).filter((old) => old.coach.id !== candidate.id),
    ].slice(0, 20);
    return g;
  }
  function resolveCoach(g: GameState, d: CoachDeal) {
    const demand = d.coach.salary * (1 + Math.max(0, d.coach.skill - g.reputation - 8) * 0.015);
    const cost = d.salary * 0.5 + d.compensation;
    if (cost > g.budget || d.salary < demand * 0.65 || g.staff.some((c) => c.id === d.coach.id)) {
      d.status = 'rejected';
      record(
        g,
        d,
        cost > g.budget
          ? '계약금과 기존 코치 보상금을 감당할 예산이 부족합니다.'
          : '현재 보직과 계약 조건으로는 합류하기 어렵다는 답변입니다.',
      );
    } else if (d.salary < demand || d.years < 2) {
      d.status = 'counter';
      d.salary = Math.ceil(demand);
      d.years = Math.max(2, d.years);
      record(
        g,
        d,
        `${d.role} 코치로 연봉 ${money(d.salary)}, ${d.years}년 계약을 원합니다. 수락하거나 조건을 수정해 주세요.`,
      );
    } else {
      d.status = 'accepted';
      record(g, d, '보직과 계약 조건에 동의했습니다. 최종 서명 후 코칭 스태프에 합류합니다.');
    }
    d.responseDay = undefined;
    d.expires = g.day + 7;
    notify(g, d, '코치 협상 답변');
  }
  function tick(g: GameState) {
    for (const d of [...g.deals, ...(g.coachDeals || [])]) {
      if (d.status === 'pending' && (d.year !== g.year || g.day >= (d.responseDay ?? g.day))) {
        if (d.year !== g.year) {
          d.status = 'expired';
          record(g, d, '시즌이 바뀌어 제안이 만료됐습니다.');
          notify(g, d, '제안 만료');
        } else if ('coach' in d) resolveCoach(g, d);
        else resolvePlayer(g, d);
      } else if (['accepted', 'counter'].includes(d.status) && isExpired(g, d)) {
        d.status = 'expired';
        record(g, d, '답변 유효기간이 지나 협상이 종료됐습니다.');
        notify(g, d, '제안 만료');
      }
    }
  }
  function action(g: GameState, a: Record<string, unknown>): GameState | null {
    if (a.type === 'coachOffer' || a.type === 'coach') return coachOffer(g, a);
    if (
      ![
        'acceptDealCounter',
        'withdrawDeal',
        'acceptCoachCounter',
        'withdrawCoach',
        'signCoach',
      ].includes(String(a.type))
    )
      return null;
    const isCoach = String(a.type).includes('Coach');
    const d = (isCoach ? g.coachDeals || [] : g.deals).find((d) => d.id === a.id);
    if (!d) throw new Error('협상을 찾을 수 없습니다.');
    if (String(a.type).startsWith('withdraw')) {
      if (['withdrawn', 'expired'].includes(d.status)) throw new Error('이미 종료된 협상입니다.');
      d.status = 'withdrawn';
      d.responseDay = undefined;
      record(g, d, '구단이 협상을 철회했습니다.');
      return g;
    }
    requireReply(g, d);
    if (a.type === 'signCoach' && 'coach' in d) {
      if (d.status !== 'accepted') throw new Error('역제안을 수락한 뒤 최종 계약할 수 있습니다.');
      if (g.staff.some((c) => c.id === d.coach.id)) throw new Error('이미 선임된 코치입니다.');
      if (g.staff.find((c) => c.role === d.role)?.id !== d.replacesId)
        throw new Error('담당 코치가 바뀌었습니다. 교체 조건을 다시 제안해 주세요.');
      const cost = d.salary * 0.5 + d.compensation;
      if (g.budget < cost) throw new Error('코치 계약 예산이 부족합니다.');
      g.budget -= cost;
      g.expenses += cost;
      g.staff = [
        ...g.staff.filter((c) => c.role !== d.role),
        { ...d.coach, role: d.role, salary: d.salary, contractUntil: g.year + d.years },
      ];
      g.coachDeals = g.coachDeals!.filter((old) => old.id !== d.id);
      postNews(
        g,
        `${d.coach.name} ${d.role} 코치 선임`,
        `${d.years}년 · 연봉 ${money(d.salary)} · 계약금 및 보상금 ${money(cost)}`,
        'transfer',
        { actionView: 'staff' },
      );
    } else {
      if (d.status !== 'counter') throw new Error('수락할 역제안이 없습니다.');
      if ('player' in d && d.stage === 'club') {
        d.stage = 'player';
        d.status = 'pending';
        d.responseDay = g.day + 1;
        d.expires = undefined;
        record(g, d, '구단의 이적료 역제안을 수락했습니다. 에이전트가 개인 조건을 검토합니다.');
      } else {
        d.status = 'accepted';
        record(g, d, '역제안에 동의했습니다. 최종 계약 내용을 확인하고 서명해 주세요.');
      }
    }
    return g;
  }
  return { negotiate, signDeal, tick, action };
}
