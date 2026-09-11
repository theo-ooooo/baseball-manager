import type { GameState } from '@dugout/shared/types';
import type { ManagerConversationState } from '@dugout/shared/manager-commands';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { finalManagerTerms, managerJobOpen } from '@dugout/shared/manager-career';
const round = (value: number) => Math.round(value * 100) / 100;

export function prepareManagerTerms(o: ManagerOffer) {
  const t = (o.contractTerms ??= {
    status: 'proposal',
    salary: o.salary,
    signingBonus: o.signingBonus || 0,
    years: 1,
    targetRank: o.targetRank,
    round: 0,
    version: 1,
    history: [],
  });
  // Legacy saves get a single fixed envelope; previously promised terms remain valid.
  if (!o.negotiationBudget) {
    const salary = Math.max(t.salary, round(o.salary * 1.45));
    const signingBonus = Math.max(t.signingBonus || 0, round(o.salary * 0.35));
    o.negotiationBudget = {
      salary,
      signingBonus,
      years: 3,
      total: round(salary * 3 + signingBonus),
    };
  }
  return t;
}
export function tickManagerTerms(g: GameState, o: ManagerOffer) {
  const t = o.contractTerms;
  if (o.status !== 'offered' || !t || t.status !== 'pending' || !t.due || t.due > gameDate(g))
    return false;
  prepareManagerTerms(o);
  const budget = o.negotiationBudget!,
    proposed = t.proposed!;
  const competitors = new Set(
    g
      .managerCareer!.offers.filter(
        (other) =>
          other.club !== o.club &&
          other.expires >= gameDate(g) &&
          ['interview', 'offered'].includes(other.status),
      )
      .map((other) => other.club),
  ).size;
  const performance = o.valuation?.performance || 0;
  const finalRound = t.round >= 3;
  const willingness = Math.min(
    1,
    0.32 + Math.min(2, competitors) * 0.22 + performance * 0.25 + (t.round - 1) * 0.2,
  );
  const annualLimit = finalRound
    ? budget.salary
    : Math.min(
        budget.salary,
        Math.max(t.salary, round(o.salary + Math.max(0, budget.salary - o.salary) * willingness)),
      );
  const bonusLimit = finalRound
    ? budget.signingBonus
    : Math.min(
        budget.signingBonus,
        Math.max(
          t.signingBonus || 0,
          round(
            (o.signingBonus || 0) +
              Math.max(0, budget.signingBonus - (o.signingBonus || 0)) * willingness,
          ),
        ),
      );
  const yearsLimit = Math.min(
    budget.years,
    finalRound || competitors >= 2 || performance >= 0.7 ? 3 : 2,
  );
  const bonus = proposed.signingBonus || 0;
  const satisfied =
    proposed.salary <= annualLimit &&
    bonus <= bonusLimit &&
    proposed.years <= yearsLimit &&
    proposed.targetRank <= o.targetRank &&
    round(proposed.salary * proposed.years + bonus) <= budget.total;
  t.status = satisfied ? 'agreed' : finalRound ? 'final' : 'counter';
  t.salary = satisfied
    ? proposed.salary
    : Math.min(annualLimit, Math.max(t.salary, proposed.salary));
  t.signingBonus = satisfied ? bonus : Math.min(bonusLimit, Math.max(t.signingBonus || 0, bonus));
  t.years = Math.min(yearsLimit, proposed.years);
  t.targetRank = Math.min(o.targetRank, proposed.targetRank);
  t.version++;
  t.history.push({
    date: gameDate(g),
    speaker: 'board',
    text: satisfied
      ? '제안하신 조건을 수락합니다. 합의한 조건은 확정되었으며 최종 서명만 남았습니다.'
      : finalRound
        ? '이 조건이 구단에서 드릴 수 있는 최종 제안입니다. 배정된 예산을 더 늘릴 수 없습니다. 수락하거나 협상을 종료해 주십시오.'
        : `${competitors ? '다른 구단과의 협상 상황을 고려했습니다. ' : ''}구단 예산 안에서 조건을 조정했습니다. 아래 역제안을 검토해 주십시오.`,
    salary: t.salary,
    signingBonus: t.signingBonus,
    years: t.years,
    targetRank: t.targetRank,
  });
  delete t.proposed;
  delete t.due;
  o.message = t.history.at(-1)!.text;
  o.expires = addDays(gameDate(g), 14);
  return true;
}
export function managerContractAction<T extends ManagerConversationState>(
  g: T,
  a: Record<string, unknown>,
) {
  if (!['negotiateManagerContract', 'acceptManagerTerms'].includes(String(a.type))) return null;
  if (g.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
  const o = g.managerCareer?.offers.find((o) => o.id === a.id);
  if (
    !o ||
    o.status !== 'offered' ||
    o.expires < gameDate(g) ||
    !g.managerJobs?.[o.club] ||
    !managerJobOpen(g.managerJobs[o.club])
  )
    throw new Error('유효한 계약 협상이 없습니다.');
  const t = prepareManagerTerms(o);
  if (a.termsVersion !== t.version)
    throw new Error('계약 조건이 변경됐습니다. 최신 계약서를 확인해 주세요.');
  if (t.status === 'pending') throw new Error('이사회가 수정 제안을 검토하고 있습니다.');
  if (t.status === 'agreed')
    throw new Error(
      '이미 합의한 조건입니다. 조건을 다시 수정할 수 없으며 최종 서명을 진행해 주세요.',
    );
  if (a.type === 'acceptManagerTerms') {
    t.status = 'agreed';
    t.version++;
    t.history.push({
      date: gameDate(g),
      speaker: 'manager',
      text: '구단이 제시한 조건에 동의합니다.',
      salary: t.salary,
      signingBonus: t.signingBonus || 0,
      years: t.years,
      targetRank: t.targetRank,
    });
    return g;
  }
  if (finalManagerTerms(t))
    throw new Error(
      '구단의 최종 제안입니다. 더 이상 수정할 수 없습니다. 현재 조건에 동의하거나 협상을 종료해 주세요.',
    );
  const salary = Number(a.salary),
    signingBonus = Number(a.signingBonus ?? t.signingBonus ?? 0),
    years = Number(a.years),
    targetRank = Number(a.targetRank);
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    salary > o.salary * 3 ||
    !Number.isFinite(signingBonus) ||
    signingBonus < 0 ||
    signingBonus > o.salary * 3 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 3 ||
    !Number.isInteger(targetRank) ||
    targetRank < 1 ||
    targetRank > o.targetRank + 2
  )
    throw new Error('연봉·계약금·기간·목표 순위의 제안 범위를 확인해 주세요.');
  t.proposed = {
    salary: Math.round(salary * 1e6) / 1e6,
    signingBonus: Math.round(signingBonus * 1e6) / 1e6,
    years,
    targetRank,
  };
  t.status = 'pending';
  t.round++;
  t.version++;
  t.due = addDays(gameDate(g), 1);
  t.history.push({
    date: gameDate(g),
    speaker: 'manager',
    text: '계약 조건을 수정해 제안했습니다.',
    ...t.proposed,
  });
  o.message = '이사회가 수정 제안을 검토합니다. 내일 수신함으로 답변합니다.';
  return g;
}
