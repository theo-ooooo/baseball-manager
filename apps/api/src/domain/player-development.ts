import type { GameState, Player, PlayerDevelopment } from '@dugout/shared/types';
import { coachSkill, hash } from '@dugout/shared/game-view';
import { gameDate, daysBetween } from '@dugout/shared/calendar';
import {
  abilityKeys,
  abilityAverage,
  growthLabels,
  visibleChange,
} from '@dugout/shared/development';
import { detailedAttributes } from '@dugout/shared/player-attributes';
import { isUnrated } from '@dugout/shared/ratings';
import { postNews } from './club-dynamics';
import { checkTrainingGoal, individualTrainingFactors } from './individual-training';

function curveFor(p: Player): Pick<PlayerDevelopment, 'pattern' | 'curve'> {
  const seed = hash(`${p.id}:development-v1`);
  const pattern = (['early', 'steady', 'late', 'durable'] as const)[seed % 4];
  const offset = (Math.floor(seed / 4) % 3) - 1;
  const peak =
    { early: 24, steady: 27, late: 30, durable: 27 }[pattern] + offset + (p.pos === 'P' ? 1 : 0);
  return {
    pattern,
    curve: {
      peak,
      decline: peak + { early: 5, steady: 6, late: 5, durable: 10 }[pattern],
      growth: 2.6 + (Math.floor(seed / 13) % 25) / 10,
      durability: 0.7 + (Math.floor(seed / 97) % 7) / 10,
    },
  };
}
function stage(p: Player) {
  const c = p.development!.curve!;
  return p.age < c.peak ? 'growth' : p.age < c.decline ? 'peak' : 'decline';
}
function snapshot(g: GameState, p: Player) {
  return {
    date: gameDate(g),
    age: p.age,
    overall: abilityAverage(p),
    abilities: Object.fromEntries(abilityKeys.map((k) => [k, p[k]])) as Record<
      (typeof abilityKeys)[number],
      number
    >,
  };
}
export function prepareDevelopment(g: GameState) {
  if (g.liveMatch) return;
  for (const p of g.roster) {
    if (!p.development) {
      const traits = curveFor(p);
      p.development = {
        version: 1,
        ...traits,
        stage: 'growth',
        history: [snapshot(g, p)],
        lastGames: { year: g.year, first: p.stats.g, reserve: p.reserveStats?.g || 0 },
      };
    }
    p.development.curve ??= curveFor(p).curve;
    p.development.stage = stage(p);
  }
}
export function developPlayers(g: GameState) {
  prepareDevelopment(g);
  const date = gameDate(g),
    seasonDays = Math.max(60, g.rounds + (g.rules?.preseason ? 28 : 0));
  for (const p of g.roster) {
    const d = p.development!,
      c = d.curve!;
    if (d.lastTrained === date) continue;
    const previous = d.lastGames;
    const appeared =
      previous.year === g.year &&
      (p.stats.g > previous.first || (p.reserveStats?.g || 0) > previous.reserve);
    d.lastGames = { year: g.year, first: p.stats.g, reserve: p.reserveStats?.g || 0 };
    d.lastTrained = date;
    const workload = appeared ? 1.25 : p.squad === 'reserve' ? 0.7 : 0.5;
    const freshness = 0.35 + Math.max(0, Math.min(100, p.condition)) / 150;
    const training =
      g.training === 'rest'
        ? 0.12
        : g.training === 'intense'
          ? p.condition >= 65
            ? 1.2
            : 0.55
          : 1;
    const planFactors = individualTrainingFactors(g, p);
    for (const key of abilityKeys) {
      if (
        (p.pos === 'P' && ['contact', 'power'].includes(key)) ||
        (p.pos !== 'P' && ['stuff', 'control'].includes(key))
      )
        continue;
      const role =
        key === 'stuff' || key === 'control'
          ? '투수'
          : key === 'field'
            ? '수비'
            : key === 'speed'
              ? '체력'
              : '타격';
      const coaching = 0.55 + coachSkill(g, role) / 120;
      const focus =
        (g.training === 'power' && key === 'power') ||
        (g.training === 'pitching' && ['stuff', 'control'].includes(key)) ||
        (g.training === 'defense' && key === 'field')
          ? 1.4
          : 1;
      const individual = 0.85 + (hash(`${p.id}:${key}`) % 31) / 100;
      const planFactor = planFactors[key];
      let delta = 0;
      if (d.stage === 'growth')
        delta =
          (c.growth *
            coaching *
            workload *
            freshness *
            training *
            focus *
            individual *
            planFactor) /
          seasonDays;
      else if (d.stage === 'peak')
        delta = (0.35 * coaching * workload * training * focus * planFactor) / seasonDays;
      else {
        const ageLoss = (1 + (p.age - c.decline) * 0.3) * c.durability;
        const physical =
          key === 'speed' ? 1.6 : key === 'stuff' ? 1.1 : key === 'control' ? 0.45 : 0.8;
        const care =
          1 - Math.min(0.3, coachSkill(g, '체력') / 400 + (g.training === 'rest' ? 0.08 : 0));
        delta = (-ageLoss * physical * care * individual) / seasonDays;
      }
      if (delta > 0) delta = Math.min(delta, Math.max(0, p.potential - p[key]));
      p[key] = Math.max(20, Math.min(99, p[key] + delta));
    }
    checkTrainingGoal(g, p);
  }
}
export function developmentReports(g: GameState) {
  const reviewed: { p: Player; change: number; changes: string[]; from: string }[] = [];
  for (const p of g.roster) {
    const d = p.development;
    if (!d) continue;
    const last = d.history.at(-1);
    if (!last || daysBetween(last.date, gameDate(g)) < 28) continue;
    const now = snapshot(g, p);
    const changes = detailedAttributes(p).flatMap(({ label, key, value }) => {
      if (!key || value === null) return [];
      const change = visibleChange(p[key] - last.abilities[key]);
      return change
        ? [`${change > 0 ? '↗' : '↘'} ${label} ${change > 0 ? '+' : ''}${change.toFixed(2)}`]
        : [];
    });
    reviewed.push({ p, change: now.overall - last.overall, changes, from: last.date });
    d.history = [...d.history, now].slice(-18);
  }
  if (!reviewed.length) return;
  const measured = reviewed.filter(({ p }) => !isUnrated(p));
  const growing = measured
    .filter((x) => visibleChange(x.change) > 0)
    .sort((a, b) => b.change - a.change);
  const declining = measured
    .filter((x) => visibleChange(x.change) < 0)
    .sort((a, b) => a.change - b.change);
  const lines = [
    `최근 4주 · 성장 ${growing.length}명 · 유지 ${measured.length - growing.length - declining.length}명 · 하락 ${declining.length}명.`,
  ];
  for (const { p, change } of [...growing.slice(0, 3), ...declining.slice(0, 3)])
    lines.push(
      `${p.name} (${growthLabels[p.development!.stage]}) ${change >= 0 ? '+' : ''}${change.toFixed(1)}`,
    );
  lines.push('선수 상세의 성장 기록에서 능력 변화와 육성 방향을 확인하세요.');
  postNews(g, '선수 성장·하락 보고', lines.join('\n'), 'development', {
    actionView: 'squad',
    sender: { name: '육성 담당 코치', role: '능력 변화 관찰' },
    report: {
      facts: [
        { label: '능력 상승', value: `${growing.length}명` },
        { label: '능력 하락', value: `${declining.length}명` },
        { label: '수치 평가 보류', value: `${reviewed.length - measured.length}명` },
      ],
      players: [...measured]
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .map(({ p, change, changes, from }) => ({
          id: p.id,
          name: p.name,
          detail: `${from} 대비 OVR ${visibleChange(change) > 0 ? '+' : ''}${visibleChange(change).toFixed(2)} · ${changes.join(' · ') || '주요 능력 유지'}`,
        })),
      sections: [
        {
          title: '변화를 확인하는 방법',
          body: '선수 이름을 누르면 상세 능력치 옆에 상승·하락 화살표와 변화량이 표시됩니다. 선수단과 1군·2군 명단에서도 OVR 변화를 확인할 수 있습니다. 과거 보고의 변화량은 보고 당시 기록으로 유지됩니다.',
        },
      ],
    },
  });
}
