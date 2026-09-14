import { playKind } from './replay';
import type { GameState, Result } from './types';
import { conversationKey } from './match-media';
export type DefensivePlan = 'balanced' | 'holdRunners' | 'guardPower' | 'attackZone';
export const defensivePlans: Record<
  DefensivePlan,
  { label: string; detail: string; tradeoff: string }
> = {
  balanced: {
    label: '균형 수비',
    detail: '현재 투수 운용과 수비 계획을 유지합니다.',
    tradeoff: '특정 공격 패턴에 추가로 대응하지 않습니다.',
  },
  holdRunners: {
    label: '주자 견제',
    detail: '도루 성공 가능성을 낮춥니다.',
    tradeoff: '주자가 있을 때 타자 집중력이 조금 떨어져 볼넷·피안타 위험이 늘어납니다.',
  },
  guardPower: {
    label: '장타 경계',
    detail: '정면 승부를 줄여 홈런 위험을 낮춥니다.',
    tradeoff: '볼넷이 늘 수 있어 볼을 기다리는 타선에 주의해야 합니다.',
  },
  attackZone: {
    label: '스트라이크 선점',
    detail: '적극적으로 승부해 볼넷을 줄입니다.',
    tradeoff: '타자가 공격적으로 나오면 안타·홈런 위험이 커집니다.',
  },
};
export type TacticalEvidence = {
  id: string;
  date: string;
  club: string;
  pa: number;
  steals: number;
  power: number;
  patient: number;
  hr: number;
  bb: number;
};
export type TacticalRead = {
  kind: 'unknown' | 'balanced' | 'running' | 'power' | 'patient';
  games: number;
  pa: number;
  steals: number;
  power: number;
  patient: number;
  hr: number;
  bb: number;
  detail: string;
};
export type TacticalDuel = {
  version: 1;
  home: { plan: DefensivePlan; read: TacticalRead; selected: boolean };
  away: { plan: DefensivePlan; read: TacticalRead; selected: boolean };
};
export type TacticalMemory = {
  observations: TacticalEvidence[];
  selection?: { key: string; plan: DefensivePlan };
};
export function tacticalRead(g: GameState, club: string): TacticalRead {
  const games = (g.engagement?.tactics?.observations || [])
    .filter((o) => o.club === club)
    .slice(-4);
  const totals = games.reduce(
    (s, o) => ({
      pa: s.pa + o.pa,
      steals: s.steals + o.steals,
      power: s.power + o.power,
      patient: s.patient + o.patient,
      hr: s.hr + o.hr,
      bb: s.bb + o.bb,
    }),
    { pa: 0, steals: 0, power: 0, patient: 0, hr: 0, bb: 0 },
  );
  const kind =
    games.length < 2 || totals.pa < 45
      ? 'unknown'
      : totals.steals >= 3
        ? 'running'
        : totals.power / totals.pa >= 0.45 || (totals.hr >= 3 && totals.hr / totals.pa >= 0.04)
          ? 'power'
          : totals.patient / totals.pa >= 0.45 || totals.bb / totals.pa >= 0.12
            ? 'patient'
            : 'balanced';
  const detail =
    kind === 'unknown'
      ? `관측 ${games.length}경기. 두 경기 이상을 본 뒤 공격 패턴을 판단합니다.`
      : kind === 'running'
        ? `최근 관측 ${games.length}경기에서 도루 ${totals.steals}회 시도.`
        : kind === 'power'
          ? `최근 관측 ${games.length}경기 · 강공 ${totals.power}/${totals.pa}타석, 홈런 ${totals.hr}개.`
          : kind === 'patient'
            ? `최근 관측 ${games.length}경기 · 볼 고르기 ${totals.patient}/${totals.pa}타석, 볼넷 ${totals.bb}개.`
            : `최근 관측 ${games.length}경기에서 뚜렷한 공격 편중은 없습니다.`;
  return { kind, games: games.length, ...totals, detail };
}
export function counterPlan(read: TacticalRead): DefensivePlan {
  return read.kind === 'running'
    ? 'holdRunners'
    : read.kind === 'power'
      ? 'guardPower'
      : read.kind === 'patient'
        ? 'attackZone'
        : 'balanced';
}
export function tacticalDuel(g: GameState, home: string, away: string): TacticalDuel | undefined {
  if (g.phase === 'preseason' || ![home, away].includes(g.club)) return;
  const selection = g.engagement?.tactics?.selection,
    key = conversationKey(g, [home, away]);
  const side = (club: string, opponent: string) => {
    const read = tacticalRead(g, opponent),
      selected = club === g.club && selection?.key === key;
    return { read, selected, plan: selected ? selection.plan : counterPlan(read) };
  };
  return { version: 1, home: side(home, away), away: side(away, home) };
}
export function tacticalEvidence(result: Result, side: 0 | 1): TacticalEvidence {
  const plays = result.log.filter((e) => e.half === side && e.play);
  const appearances = plays.filter((e) => e.play!.plateAppearance !== false);
  return {
    id: result.id,
    date: result.date || '',
    club: side ? result.home : result.away,
    pa: appearances.length,
    steals: plays.filter((e) => e.play!.steal).length,
    power: appearances.filter(
      (e) => e.play!.battingIntent === 'power' || e.play!.command === 'swingAway',
    ).length,
    patient: appearances.filter(
      (e) => e.play!.battingIntent === 'patient' || e.play!.command === 'workCount',
    ).length,
    hr: appearances.filter((e) => playKind(e.text) === 'homeRun').length,
    bb: appearances.filter(
      (e) => playKind(e.text) === 'walk' && e.play!.command !== 'intentionalWalk',
    ).length,
  };
}
