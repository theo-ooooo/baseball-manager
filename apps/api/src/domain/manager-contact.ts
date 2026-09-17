import { daysBetween, gameDate } from '@dugout/shared/calendar';
import {
  lastManagerProposal,
  type ManagerCareer,
  type ManagerOffer,
} from '@dugout/shared/manager-career';
import type { ManagerConversationState } from '@dugout/shared/manager-commands';

/** Keep contact history even after old offers are trimmed or the manager changes clubs. */
export function closeManagerContact(g: ManagerConversationState, offer: ManagerOffer) {
  if (offer.closedAt || !['rejected', 'expired'].includes(offer.status)) return;
  offer.closedAt = gameDate(g);
  const last = g.managerCareer?.approachHistory?.[offer.club];
  // Do not let a legacy duplicate overwrite a more recent negotiation's refusal.
  if (last && offer.applied < last.closedAt) return;
  const previous = lastManagerProposal(offer);
  const terms = offer.contractTerms;
  const salary = terms?.salary ?? offer.salary;
  const bonus = terms?.signingBonus ?? offer.signingBonus ?? 0;
  (g.managerCareer!.approachHistory ??= {})[offer.club] = {
    closedAt: offer.closedAt,
    ...(terms?.status !== 'agreed' && previous && previous.salary > salary
      ? { minSalary: previous.salary }
      : {}),
    ...(terms?.status !== 'agreed' && previous && (previous.signingBonus || 0) > bonus
      ? { minSigningBonus: previous.signingBonus }
      : {}),
  };
}

export function managerContactAvailable(m: ManagerCareer, club: string, today: string) {
  if (
    m.offers.some(
      (o) =>
        o.club === club &&
        ['invited', 'pending', 'interview', 'offered'].includes(o.status) &&
        o.expires >= today,
    )
  )
    return false;
  const last = m.approachHistory?.[club];
  return !last || daysBetween(last.closedAt, today) >= 28;
}

/** Automatic outreach must remember why a previous employment ended. */
export function recentManagerDeparture(m: ManagerCareer, club: string, today: string) {
  const last = m.history
    .filter((h) => h.club === club && h.to <= today)
    .sort((a, b) => b.to.localeCompare(a.to))[0];
  if (!last) return false;
  return (
    daysBetween(last.to, today) < 28 ||
    ((last.reason === 'sacked' || last.endKind === 'nonrenewal') &&
      last.to.slice(0, 4) === today.slice(0, 4))
  );
}

export function closeDepartedClubApproaches(g: ManagerConversationState) {
  const m = g.managerCareer;
  if (!m) return;
  const today = gameDate(g);
  for (const o of m.offers) {
    if (
      o.source !== 'approach' ||
      !recentManagerDeparture(m, o.club, today) ||
      !['invited', 'pending', 'interview', 'offered'].includes(o.status)
    )
      continue;
    o.status = 'expired';
    o.message = '최근 감독 계약이 종료된 구단의 자동 채용 연락을 정리했습니다.';
    closeManagerContact(g, o);
  }
}

export function managerContactTermsFit(
  m: ManagerCareer,
  club: string,
  terms: { salary: number; signingBonus?: number },
) {
  const last = m.approachHistory?.[club];
  return (
    terms.salary >= (last?.minSalary || 0) &&
    (terms.signingBonus || 0) >= (last?.minSigningBonus || 0)
  );
}
