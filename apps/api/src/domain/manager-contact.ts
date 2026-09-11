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
