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
  const pitchers = players.filter((p) => p.pos === 'P');
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
  const active = firstTeam(g).filter((p) => p.pos === 'P'),
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
