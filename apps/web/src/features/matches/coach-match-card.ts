import type { GameState } from '@dugout/shared/types';
import { selectedMatchCards, matchCardGrades } from '@dugout/shared/match-cards';
import { matchCardUseReason } from '@dugout/shared/match-card-decisions';
import { matchDecision } from '@dugout/shared/match-decision';

/** Advice is based on owned unused cards and the already completed game state. */
export function coachMatchCard(g: GameState, cursor: number) {
  const live = g.liveMatch;
  if (live?.cards?.version !== 2 || !live.cards.selected || !live.timeline) return undefined;
  const options = selectedMatchCards(live.cards).filter(
    (card) => !matchCardUseReason(live, g.club, cursor, card.id),
  );
  if (!options.length) return undefined;
  const decision = matchDecision(live, g.club, cursor);
  const own = live.home === g.club ? 1 : 0;
  const score = live.timeline.log[cursor - 1]?.score || [0, 0];
  const needPower = score[1 - own] - score[own] >= 2 && decision.outs < 2;
  const priority = (kind: string) =>
    kind === 'nullify'
      ? 100
      : kind === (decision.attacking ? (needPower ? 'power' : 'contact') : 'batterPressure')
        ? 20
        : 0;
  const card = options.toSorted(
    (a, b) =>
      priority(b.kind) +
      matchCardGrades[b.grade].percent -
      (priority(a.kind) + matchCardGrades[a.grade].percent),
  )[0];
  const coach =
    g.staff.find(
      (staff) =>
        staff.role === (decision.attacking ? '타격' : '투수') &&
        (staff.contractUntil === undefined || staff.contractUntil > g.year),
    ) ||
    g.staff.find(
      (staff) =>
        staff.role === '수석' &&
        (staff.contractUntil === undefined || staff.contractUntil > g.year),
    );
  const reason =
    card.kind === 'nullify'
      ? '상대 증강이 아직 남아 있습니다. 이번 타석의 자동 발동을 막을 수 있습니다.'
      : card.kind === 'power'
        ? needPower
          ? '두 점 이상 뒤져 있습니다. 득점권 주자를 장타로 불러들릴 때입니다.'
          : '득점권에 주자가 있습니다. 이번 타자의 파워를 높여 장타를 노립니다.'
        : card.kind === 'contact'
          ? `${decision.outs === 2 ? '2사 득점 기회입니다.' : '득점권에 주자가 있습니다.'} 이번 타자의 컨택을 높여 안타를 노립니다.`
          : card.kind === 'batterPressure'
            ? '득점권에 상대 주자가 있습니다. 이번 타자의 컨택과 파워를 낮춥니다.'
            : card.kind === 'control'
              ? '실점 위기에서 투수 제구를 높여 이번 타자를 상대합니다.'
              : '득점 기회에서 상대 투수의 구위와 제구를 낮춰 승부합니다.';
  return { card, reason, coach: coach ? `${coach.name} 코치` : '더그아웃' };
}
