import type { Player } from './types';
import { overall, askPrice } from './game-view';
import { playerPersonality } from './personality';

/** Game assessment, not a claim about the real person's reputation or consent rights. */
export function playerClubStanding(p: Player, roster: Player[]) {
  const rank = [...roster]
    .sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
    .findIndex((v) => v.id === p.id);
  const ability = overall(p),
    traits = playerPersonality(p);
  const home = traits.homeClub === p.club;
  const franchise =
    rank >= 0 && rank < 3 && ability >= 72 && p.age >= 27 && home && traits.loyalty >= 75;
  const core = (rank >= 0 && rank < 3 && ability >= 68) || ability >= 83;
  const prospect = p.age <= 24 && p.potential >= Math.max(80, ability + 10);
  const starter = rank >= 0 && rank < 16 && ability >= 60;
  return franchise
    ? ({
        tier: 'franchise',
        label: '프랜차이즈 핵심',
        reason:
          '구단의 상징성과 장기 잔류 성향을 가진 핵심 선수입니다. 현금으로 협상할 대상이 아닙니다.',
      } as const)
    : core
      ? ({
          tier: 'core',
          label: '핵심 전력',
          reason: '비슷한 수준의 핵심 선수나 유망주 중심의 대체 전력이 필요합니다.',
        } as const)
      : prospect
        ? ({
            tier: 'prospect',
            label: '주요 유망주',
            reason: '미래 전력으로 평가합니다. 현금보다 성장 가능성이 있는 선수 구성을 우선합니다.',
          } as const)
        : starter
          ? ({
              tier: 'starter',
              label: '주전 자원',
              reason: '같은 포지션의 대체 전력과 현재 선수단 구성을 검토합니다.',
            } as const)
          : ({
              tier: 'depth',
              label: '선수층 자원',
              reason: '출전 기회와 포지션 수요가 맞으면 교환을 검토합니다.',
            } as const);
}
const value = (p: Player, roster: Player[]) => {
  const tier = playerClubStanding(p, roster).tier;
  return (
    Math.max(8, askPrice(p), Math.pow(Math.max(15, overall(p) - 25), 2) / 15) *
    { franchise: 2.5, core: 1.65, prospect: 1.45, starter: 1.15, depth: 1 }[tier]
  );
};
/** Same valuation and cash cap used by the seller; no extra weight for the human club. */
export function tradePackageValue(
  roster: Player[],
  incoming: Player[],
  outgoing: Player[],
  cash: number,
) {
  const requested = outgoing.reduce((sum, p) => sum + value(p, roster), 0) * 1.06;
  const players = incoming.reduce(
    (sum, p) => sum + value(p, incoming.length >= 22 ? incoming : []),
    0,
  );
  return {
    requested,
    players,
    cashLimit: requested * 0.3,
    total: players + Math.min(cash, requested * 0.3),
  };
}
export function assessTradeReturn(
  roster: Player[],
  incoming: Player[],
  outgoing: Player[],
  cash: number,
) {
  const refuse = (reason: string) => ({ status: 'rejected' as const, reason, cash: 0 });
  for (const p of outgoing) {
    const standing = playerClubStanding(p, roster);
    if (standing.tier === 'franchise')
      return refuse(
        `${p.name} 선수는 ${standing.label}입니다. 구단을 대표하는 선수라 현금 액수와 관계없이 내보내지 않겠습니다.`,
      );
    if (
      standing.tier === 'core' &&
      !incoming.some((v) => overall(v) >= overall(p) - 5) &&
      incoming.filter(
        (v) => v.age <= 24 && v.potential >= p.potential && overall(v) >= overall(p) - 12,
      ).length < 2
    )
      return refuse(
        `${p.name} 선수는 핵심 전력입니다. 비슷한 수준의 선수 또는 경쟁력 있는 유망주 2명이 필요하며, 현금으로 대신할 수 없습니다.`,
      );
    if (
      standing.tier === 'prospect' &&
      !incoming.some(
        (v) =>
          overall(v) >= overall(p) + 3 ||
          (v.age <= 25 && v.potential >= p.potential - 5 && overall(v) >= overall(p) - 5),
      )
    )
      return refuse(
        `${p.name} 선수는 주요 유망주입니다. 미래 가치에 맞는 선수가 포함돼야 협상할 수 있습니다.`,
      );
  }
  const remaining = roster.filter((p) => !outgoing.some((v) => v.id === p.id));
  for (const pos of ['P', 'C', 'IF', 'OF', 'DH']) {
    const lost = outgoing.filter((p) => p.pos === pos).sort((a, b) => overall(b) - overall(a));
    const old = roster.filter((p) => p.pos === pos).sort((a, b) => overall(b) - overall(a));
    const bestAfter = [...remaining, ...incoming]
      .filter((p) => p.pos === pos)
      .sort((a, b) => overall(b) - overall(a));
    if (
      lost.some((p) => p.id === old[0]?.id) &&
      bestAfter[0] &&
      overall(bestAfter[0]) < overall(old[0]) - 10
    )
      return refuse(
        `${old[0].name} 선수가 빠지면 ${pos} 전력 공백이 큽니다. 해당 포지션의 대체 선수를 포함해 주세요.`,
      );
  }
  const {
    requested,
    players: offered,
    cashLimit: maximumCash,
  } = tradePackageValue(roster, incoming, outgoing, cash);
  if (offered < requested - maximumCash)
    return refuse(
      '선수 구성의 전력 가치 차이가 큽니다. 현금은 조건을 보완할 뿐, 선수 대가의 30%를 넘는 차이를 대신할 수 없습니다.',
    );
  const needed = Math.ceil(requested - offered);
  if (offered + Math.min(cash, maximumCash) >= requested)
    return {
      status: 'accepted' as const,
      reason:
        '선수 위상과 대체 전력, 현금 조건을 검토해 동의했습니다. 최종 확정하면 교환이 완료됩니다.',
      cash,
    };
  return {
    status: 'counter' as const,
    reason: '선수 구성에는 동의합니다. 현금 조건을 조정하면 교환할 수 있습니다.',
    cash: needed,
  };
}
