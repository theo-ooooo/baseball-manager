import type { GameState, Result } from '@dugout/shared/types';
import { defensivePlans, tacticalEvidence, type DefensivePlan } from '@dugout/shared/tactical-duel';
import { conversationKey } from '@dugout/shared/match-media';
import { prepareEngagement } from './career-engagement';
/** No RNG consumption. Both dugouts use the same bounded tradeoffs. */
export function defensivePlanModifiers(plan: DefensivePlan | undefined, runners: boolean) {
  if (plan === 'holdRunners')
    return { steal: -0.06, walk: runners ? 0.006 : 0, contact: runners ? 0.008 : 0, homeRun: 0 };
  if (plan === 'guardPower') return { steal: 0, walk: 0.01, contact: 0, homeRun: -0.025 };
  if (plan === 'attackZone') return { steal: 0, walk: -0.016, contact: 0.01, homeRun: 0.015 };
  return { steal: 0, walk: 0, contact: 0, homeRun: 0 };
}
export function recordTacticalEvidence(g: GameState, result: Result) {
  if (result.friendly || ![result.home, result.away].includes(g.club)) return;
  prepareEngagement(g);
  const t = (g.engagement!.tactics ??= { observations: [] });
  for (const side of [0, 1] as const) {
    const item = tacticalEvidence(result, side);
    if (!item.pa || t.observations.some((o) => o.club === item.club && o.id === item.id)) continue;
    const old = t.observations.filter((o) => o.club === item.club);
    const removed = new Set(old.slice(0, Math.max(0, old.length - 3)).map((o) => o.id));
    t.observations = t.observations.filter((o) => o.club !== item.club || !removed.has(o.id));
    t.observations.push(item);
  }
  t.observations = t.observations.slice(-48);
}
export function setDefensivePlan(
  g: GameState,
  a: Record<string, unknown>,
  pair: string[] | null | undefined,
) {
  if (a.type !== 'setDefensivePlan') return null;
  if (g.liveMatch) throw new Error('수비 대응은 경기 시작 전에 정해 주세요.');
  if (
    g.managerCareer?.status !== 'employed' ||
    g.managerCareer.vacationUntil ||
    !pair ||
    g.phase === 'preseason'
  )
    throw new Error('정규시즌·포스트시즌 경기 준비에서 대응을 정해 주세요.');
  const key = conversationKey(g, pair);
  if (a.key !== key || typeof a.plan !== 'string' || !Object.hasOwn(defensivePlans, a.plan))
    throw new Error('오늘 경기와 수비 대응을 다시 확인해 주세요.');
  prepareEngagement(g);
  const t = (g.engagement!.tactics ??= { observations: [] });
  t.selection = { key, plan: a.plan as DefensivePlan };
  return g;
}
