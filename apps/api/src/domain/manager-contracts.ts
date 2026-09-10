import type { GameState } from '@dugout/shared/types';
import type { ManagerConversationState } from '@dugout/shared/manager-commands';
import type { ManagerOffer } from '@dugout/shared/manager-career';
import { addDays, gameDate } from '@dugout/shared/calendar';
import { managerJobOpen } from '@dugout/shared/manager-career';
export function prepareManagerTerms(o: ManagerOffer) {
  return (o.contractTerms ??= {
    status: 'proposal',
    salary: o.salary,
    years: 1,
    targetRank: o.targetRank,
    round: 0,
    version: 1,
    history: [],
  });
}
export function tickManagerTerms(g: GameState, o: ManagerOffer) {
  const t = o.contractTerms;
  if (o.status !== 'offered' || !t || t.status !== 'pending' || !t.due || t.due > gameDate(g))
    return false;
  const proposed = t.proposed!;
  const ceiling = Math.round(
    o.salary * (1.12 + Math.min(3, Math.max(0, o.targetRank - proposed.targetRank)) * 0.05),
  );
  const satisfied =
    proposed.salary <= ceiling && proposed.targetRank <= o.targetRank && proposed.years <= 2;
  t.status = satisfied ? 'agreed' : 'counter';
  t.salary = satisfied ? proposed.salary : Math.min(proposed.salary, ceiling);
  t.years = Math.min(2, proposed.years);
  t.targetRank = Math.min(o.targetRank, proposed.targetRank);
  t.version++;
  t.history.push({
    date: gameDate(g),
    speaker: 'board',
    text: satisfied
      ? '제안하신 조건에 동의합니다. 최종 계약서를 확인해 주십시오.'
      : '연봉·기간·성적 목표를 검토한 결과, 수정된 조건으로 역제안합니다.',
    salary: t.salary,
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
  if (a.type === 'acceptManagerTerms') {
    if (t.status === 'agreed')
      throw new Error('이미 합의한 조건입니다. 최종 서명을 진행해 주세요.');
    t.status = 'agreed';
    t.version++;
    t.history.push({
      date: gameDate(g),
      speaker: 'manager',
      text: '구단이 제시한 조건에 동의합니다.',
      salary: t.salary,
      years: t.years,
      targetRank: t.targetRank,
    });
    return g;
  }
  if (t.round >= 4)
    throw new Error('협상은 네 차례까지 가능합니다. 현재 조건에 동의하거나 협상을 종료해 주세요.');
  const salary = Number(a.salary),
    years = Number(a.years),
    targetRank = Number(a.targetRank);
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    salary > o.salary * 3 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 3 ||
    !Number.isInteger(targetRank) ||
    targetRank < 1 ||
    targetRank > o.targetRank + 2
  )
    throw new Error('연봉·계약 기간·목표 순위의 제안 범위를 확인해 주세요.');
  t.proposed = { salary: Math.round(salary * 100) / 100, years, targetRank };
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
