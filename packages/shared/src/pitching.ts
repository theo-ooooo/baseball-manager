import { isAvailable } from '@dugout/shared/long-term';
import type { GameState, Player, PitchingPlan } from '@dugout/shared/types';
import { overall } from '@dugout/shared/game-view';
import { firstTeam } from '@dugout/shared/management';

export function starterScore(p: Player) {
  const r = p.rating?.record;
  return r?.outs && r.g ? Math.min(7, r.outs / 3 / r.g) * 12 + overall(p) * 0.25 : overall(p);
}
function reliefGroups(pitchers: Player[]) {
  const ranked = [...pitchers].sort((a, b) => overall(b) - overall(a));
  const split = Math.min(2, Math.ceil(ranked.length / 2));
  return {
    setup: ranked.slice(0, split).map((p) => p.id),
    chase: ranked.slice(split).map((p) => p.id),
  };
}
export function autoPitching(players: Player[]): PitchingPlan {
  const pitchers = players.filter((p) => p.pos === 'P' && isAvailable(p));
  const starters = [...pitchers]
    .sort((a, b) => starterScore(b) - starterScore(a))
    .slice(0, Math.min(5, Math.max(1, pitchers.length - 2)));
  const relief = pitchers
    .filter((p) => !starters.includes(p))
    .sort(
      (a, b) =>
        (b.rating?.record?.sv || 0) - (a.rating?.record?.sv || 0) || overall(b) - overall(a),
    );
  return {
    rotation: starters.map((p) => p.id),
    closer: relief[0]?.id || '',
    bullpen: relief.slice(1).map((p) => p.id),
    ...reliefGroups(relief.slice(1)),
    next: 0,
  };
}
export function preparePitching(g: GameState) {
  const active = firstTeam(g).filter((p) => p.pos === 'P' && isAvailable(p)),
    valid = new Set(active.map((p) => p.id));
  if (!g.pitching) {
    g.pitching = autoPitching(active);
    // Preserve a legacy save's explicitly chosen starter.
    if (valid.has(g.starter) && !g.pitching.rotation.includes(g.starter))
      g.pitching.rotation = [g.starter, ...g.pitching.rotation.slice(0, 4)];
    if (g.pitching.rotation.includes(g.pitching.closer))
      g.pitching.closer =
        active
          .filter((p) => !g.pitching!.rotation.includes(p.id))
          .sort(
            (a, b) =>
              (b.rating?.record?.sv || 0) - (a.rating?.record?.sv || 0) || overall(b) - overall(a),
          )[0]?.id || '';
    g.pitching.next = Math.max(0, g.pitching.rotation.indexOf(g.starter));
  }
  const plan = g.pitching;
  plan.rotation = [...new Set(plan.rotation)].filter((id) => valid.has(id));
  if (!plan.rotation.length) plan.rotation = [autoPitching(active).rotation[0]].filter(Boolean);
  if (!valid.has(plan.closer) || plan.rotation.includes(plan.closer)) plan.closer = '';
  plan.bullpen = [...new Set([...plan.bullpen, ...active.map((p) => p.id)])].filter(
    (id) => valid.has(id) && !plan.rotation.includes(id) && id !== plan.closer,
  );
  // Upgrade only absent groups; explicitly empty groups are the manager's choice.
  if (plan.setup === undefined && plan.chase === undefined)
    Object.assign(plan, reliefGroups(active.filter((p) => plan.bullpen.includes(p.id))));
  plan.setup = [...new Set(plan.setup || [])].filter((id) => plan.bullpen.includes(id));
  plan.chase = [...new Set(plan.chase || [])].filter(
    (id) => plan.bullpen.includes(id) && !plan.setup!.includes(id),
  );
  plan.next = Math.max(0, Math.floor(plan.next || 0)) % Math.max(1, plan.rotation.length);
  if (!valid.has(g.starter)) g.starter = plan.rotation[plan.next];
  if (g.defense) g.defense.P = g.starter;
}
export function nextStarter(g: GameState, played = false) {
  preparePitching(g);
  const plan = g.pitching!;
  if (played) {
    const at = plan.rotation.indexOf(g.starter);
    plan.next = (at >= 0 ? at + 1 : plan.next) % plan.rotation.length;
  }
  const order = [...plan.rotation.slice(plan.next), ...plan.rotation.slice(0, plan.next)];
  g.starter =
    order.find((id) => (g.roster.find((p) => p.id === id)?.condition || 0) >= 65) || order[0];
  if (g.defense) g.defense.P = g.starter;
}
export function pitchingAssignment(g: GameState, p: Player) {
  if (p.pos !== 'P') return '';
  if (!g.roster.some((player) => player.id === p.id)) return '';
  if (p.squad === 'reserve') return 'reserve';
  const plan = g.pitching;
  if (plan?.rotation.includes(p.id)) return 'starter';
  if (plan?.closer === p.id) return 'closer';
  if (plan?.setup?.includes(p.id)) return 'setup';
  if (plan?.chase?.includes(p.id)) return 'chase';
  return 'bullpen';
}
export function pitchingRole(g: GameState, p: Player) {
  const role = pitchingAssignment(g, p);
  if (role === 'starter') return `선발 ${g.pitching!.rotation.indexOf(p.id) + 1}`;
  return {
    closer: '마무리',
    setup: '필승조',
    chase: '추격조',
    bullpen: '일반 불펜',
    reserve: '2군',
    '': '',
  }[role];
}

export function pitcherResource(p: Player) {
  const r = p.rating?.record;
  const starts = r?.gs ?? 0,
    games = r?.g ?? 0,
    inningsPerGame = games ? (r?.outs ?? 0) / 3 / games : 0;
  const reliefEvidence = (r?.sv ?? 0) + (r?.hld ?? 0);
  const starter = (starts >= 5 && starts / Math.max(1, games) >= 0.4) || inningsPerGame >= 3;
  const relief = reliefEvidence >= 3 || (games >= 15 && inningsPerGame < 2);
  return {
    resource: starter
      ? '선발 자원'
      : relief
        ? '불펜 자원'
        : p.control >= p.stuff
          ? '선발 후보'
          : '불펜 후보',
    reason: starter
      ? `선발 ${starts}경기 · 등판당 ${inningsPerGame.toFixed(2)}이닝의 기록을 우선했습니다.`
      : relief
        ? `세이브·홀드 ${reliefEvidence}개 · 짧은 이닝 등판 기록을 참고했습니다.`
        : `제구 ${p.control.toFixed(2)} · 구위 ${p.stuff.toFixed(2)}를 비교한 게임 내 추천입니다.`,
    startScore: starter
      ? 120 + Math.min(30, starts) + overall(p) * 0.3
      : relief
        ? overall(p) * 0.4
        : overall(p) * 0.7 + p.control * 0.3,
  };
}
/** Explicit coach recommendation; does not change legacy match simulation defaults. */
export function recommendedPitching(players: Player[]): PitchingPlan {
  const pitchers = players.filter((p) => p.pos === 'P' && isAvailable(p));
  const starters = [...pitchers]
    .sort(
      (a, b) =>
        pitcherResource(b).startScore - pitcherResource(a).startScore || a.id.localeCompare(b.id),
    )
    .slice(0, Math.min(5, Math.max(1, pitchers.length - 3)));
  const relief = pitchers
    .filter((p) => !starters.includes(p))
    .sort(
      (a, b) =>
        (b.rating?.record?.sv ?? 0) - (a.rating?.record?.sv ?? 0) ||
        overall(b) - overall(a) ||
        a.id.localeCompare(b.id),
    );
  return {
    rotation: starters.map((p) => p.id),
    closer: relief[0]?.id || '',
    bullpen: relief.slice(1).map((p) => p.id),
    ...reliefGroups(relief.slice(1)),
    next: 0,
  };
}
