import { battingProfile } from '@dugout/shared/player-attributes';
import { createCalendarView } from '@dugout/shared/calendar';
import { unpackStats } from './long-term';
import type { WorldCatalog, GameState, Player, Stats, Pos, Coach } from '@dugout/shared/types';
export * from '@dugout/shared/types';
export const blankStats = (): Stats => ({
  ab: 0,
  h: 0,
  hr: 0,
  rbi: 0,
  bb: 0,
  k: 0,
  outs: 0,
  er: 0,
  wins: 0,
  g: 0,
});
export function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function overall(p: Player) {
  return Math.round(
    p.pos === 'P'
      ? p.stuff * 0.58 + p.control * 0.42
      : p.contact * 0.4 + p.power * 0.3 + p.speed * 0.12 + p.field * 0.18,
  );
}
// Persisted amounts retain their original unit (USD 10,000) for save compatibility.
// Display and contract inputs use KRW at a fixed game conversion, never a live FX quote.
export const GAME_KRW_PER_USD = 1400;
export const toManwon = (amount: number) => Math.round(amount * GAME_KRW_PER_USD);
export const fromManwon = (amount: number) => amount / GAME_KRW_PER_USD;
export function money(n: number) {
  const won = Math.round(n * 10000 * GAME_KRW_PER_USD),
    abs = Math.abs(won),
    sign = won < 0 ? '−' : '';
  if (abs >= 100000000)
    return `${sign}${(abs / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억 원`;
  if (abs >= 10000)
    return `${sign}${(abs / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만 원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

export function teamBudget(league: string) {
  return league === 'mlb'
    ? 18000
    : league === 'npb'
      ? 6000
      : league === 'kbo'
        ? 3500
        : ['cpbl', 'lmb', 'lidom'].includes(league)
          ? 1600
          : 800;
}
export function lineupAuto(roster: Player[]) {
  const sorted = [...roster]
    .filter((p) => p.pos !== 'P')
    .sort((a, b) => overall(b) * b.condition - overall(a) * a.condition);
  const chosen: Player[] = [];
  for (const [pos, n] of [
    ['C', 1],
    ['IF', 4],
    ['OF', 3],
  ] as [Pos, number][]) {
    chosen.push(...sorted.filter((p) => p.pos === pos).slice(0, n));
  }
  for (const p of sorted) if (chosen.length < 9 && !chosen.includes(p)) chosen.push(p);
  const remaining = [...chosen],
    ordered: Player[] = [];
  const take = (slot: number, score: (p: Player) => number) => {
    remaining.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    const p = remaining.shift();
    if (p) ordered[slot] = p;
  };
  const onbase = (p: Player) => {
    const b = battingProfile(p);
    return b.obp * 180 + b.speed * 0.35 - b.gdp * 100;
  };
  const production = (p: Player) => {
    const b = battingProfile(p);
    return b.obp * 100 + b.slg * 85;
  };
  take(0, onbase);
  take(3, (p) => production(p) + p.power * 0.4);
  take(1, production);
  take(2, (p) => production(p) + p.contact * 0.12);
  take(4, production);
  take(8, onbase);
  for (const slot of [5, 6, 7]) take(slot, production);
  return ordered.filter(Boolean).map((p) => p.id);
}

export const coachRoles = ['타격', '투수', '수비', '체력', '스카우트'];
export function coachSkill(g: GameState, role: string) {
  return g.staff.find((c) => c.role === role)?.skill || 35;
}
export function askPrice(p: Player) {
  return (
    p.marketValue ??
    (p.club === 'fa'
      ? 0
      : Math.round(p.salary * (1.2 + p.years * 0.45) + (p.potential - overall(p)) * 3))
  );
}
// Only immutable catalog indexes are shared. Career rosters and yearly copies stay local.
const catalogIndexes = new WeakMap<
  WorldCatalog,
  {
    clubMap: Map<string, WorldCatalog['clubs'][number]>;
    leagueMap: Map<string, WorldCatalog['leagues'][number]>;
    byClub: Map<string, Player[]>;
  }
>();
type RosterIndex = {
  revision: number;
  year: number;
  own: Player[];
  transfers: Player[];
  groups: Map<string, Player[]>;
};
const worldRosterIndexes = new WeakMap<WorldCatalog, WeakMap<GameState, RosterIndex>>();
export function createGameView(world: WorldCatalog) {
  const { clubs, leagues, rosterNote } = world;
  const calendar = createCalendarView(world);
  let index = catalogIndexes.get(world);
  if (!index) {
    const byClub = new Map<string, Player[]>();
    for (const p of world.players) {
      const list = byClub.get(p.club);
      if (list) list.push(p);
      else byClub.set(p.club, [p]);
    }
    index = {
      clubMap: new Map(clubs.map((c) => [c.id, c])),
      leagueMap: new Map(leagues.map((l) => [l.id, l])),
      byClub,
    };
    catalogIndexes.set(world, index);
  }
  const { clubMap, leagueMap, byClub } = index;
  const getClub = (id: string) => clubMap.get(id)!;
  const getLeague = (id: string) => leagueMap.get(id)!;
  const cached = new Map<string, Player[]>();
  function baseRoster(club: string, year = world.year) {
    const key = club + ':' + year;
    if (!cached.has(key))
      cached.set(
        key,
        (byClub.get(club) || []).map((p) => ({
          ...p,
          age: p.age + year - world.year,
          stats: blankStats(),
        })),
      );
    return cached.get(key)!;
  }
  let realRosters: Record<string, Player[]> | undefined;
  function coachPool(year = world.year): Coach[] {
    return world.coaches.map((c) => ({
      ...c,
      id: c.id.replace('-' + world.year + '-', '-' + year + '-'),
    }));
  }
  function agentFor(p: Player) {
    return world.agents[hash(p.id) % world.agents.length];
  }
  function marketPlayers(g: GameState) {
    if (g.simulation) {
      const own = new Set(g.roster.map((p) => p.id));
      return [...worldRosterIndex(g).values()].flat().filter((p) => !own.has(p.id));
    }
    const own = new Set(g.roster.map((p) => p.id)),
      seen = new Set<string>();
    return [
      ...g.transferred,
      ...clubs
        .filter((c) => c.id !== g.club)
        .flatMap((c) =>
          baseRoster(c.id, g.year).filter((p) => !g.ownership[p.id] || g.ownership[p.id] === c.id),
        ),
      ...baseRoster('fa', g.year),
    ]
      .filter((p) => {
        if (own.has(p.id) || seen.has(p.id) || g.ownership[p.id] === g.club) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => {
        if (!p.observation) return p;
        const report = g.scouting?.reports.find((r) => r.playerId === p.id);
        return report
          ? {
              ...p,
              observation: {
                status: 'scouted' as const,
                overall: report.overall,
                abilities: report.abilities,
                date: report.date,
              },
            }
          : p;
      });
  }
  function rosterFor(g: GameState, id: string) {
    if (id === g.club) return g.roster;
    if (g.simulation) return worldRosterIndex(g).get(id) || [];
    return [
      ...baseRoster(id, g.year).filter((p) => !g.ownership[p.id]),
      ...(g.transferred || []).filter((p) => p.club === id),
    ];
  }
  let rosterIndexes = worldRosterIndexes.get(world);
  if (!rosterIndexes) {
    rosterIndexes = new WeakMap();
    worldRosterIndexes.set(world, rosterIndexes);
  }
  function worldRosterIndex(g: GameState) {
    const sim = g.simulation!;
    const cached = rosterIndexes!.get(g);
    if (
      cached?.revision === sim.revision &&
      cached.year === g.year &&
      cached.own === g.roster &&
      cached.transfers === g.transferred
    )
      return cached.groups;
    const retired = new Set(sim.retired);
    const pool = new Map<string, Player>();
    const apply = (p: Player): Player => {
      const delta = sim.players[p.id];
      const next = {
        ...p,
        club: g.ownership[p.id] || p.club,
        stats: delta ? unpackStats(delta.stats) : blankStats(),
      };
      if (delta) {
        if (delta.ratings)
          [next.contact, next.power, next.speed, next.field, next.stuff, next.control] =
            delta.ratings;
        next.reserveStats = unpackStats(delta.reserve);
        next.age = delta.age ?? next.age;
        next.salary = delta.salary ?? next.salary;
        next.years = delta.years ?? next.years;
        next.condition = delta.condition ?? 100;
        next.careerBaseline = delta.stint;
        if (delta.observation) next.observation = delta.observation;
      }
      const report = g.scouting?.reports.find((r) => r.playerId === next.id);
      if (next.observation && report)
        next.observation = {
          status: 'scouted',
          overall: report.overall,
          abilities: report.abilities,
          date: report.date,
        };
      return next;
    };
    for (const c of [...clubs.map((c) => c.id), 'fa'])
      for (const p of baseRoster(c, g.year)) if (!retired.has(p.id)) pool.set(p.id, apply(p));
    for (const [id, delta] of Object.entries(sim.players)) {
      const generated = delta.generated;
      if (!generated || retired.has(id)) continue;
      pool.set(
        id,
        apply({
          id,
          name: generated.name,
          original: generated.name,
          club: g.ownership[id] || 'fa',
          pos: generated.pos,
          country: generated.country,
          number: generated.number,
          age: g.year - generated.born,
          real: false,
          contact: 40,
          power: 40,
          speed: 40,
          field: 40,
          stuff: 40,
          control: 40,
          potential: generated.potential,
          salary: 1,
          years: 1,
          condition: 100,
          stats: blankStats(),
        }),
      );
    }
    for (const p of g.transferred) if (!retired.has(p.id)) pool.set(p.id, p);
    for (const p of g.roster) pool.set(p.id, p);
    const groups = new Map<string, Player[]>();
    for (const p of pool.values()) {
      const list = groups.get(p.club) || [];
      list.push(p);
      groups.set(p.club, list);
    }
    rosterIndexes!.set(g, {
      revision: sim.revision,
      year: g.year,
      own: g.roster,
      transfers: g.transferred,
      groups,
    });
    return groups;
  }
  function standings(g: GameState, league = getClub(g.club).league) {
    return [...g.standings[league]].sort(
      (a, b) =>
        b.w / (b.w + b.l || 1) - a.w / (a.w + a.l || 1) ||
        b.w - a.w ||
        b.rf - b.ra - (a.rf - a.ra) ||
        a.club.localeCompare(b.club),
    );
  }
  function pairings(league: string, day: number) {
    const ids = clubs.filter((c) => c.league === league).map((c) => c.id);
    if (ids.length % 2) ids.push('bye');
    const n = ids.length,
      round = day % (n - 1),
      cycle = Math.floor(day / (n - 1));
    for (let i = 0; i < round; i++) ids.splice(1, 0, ids.pop()!);
    const pairs: string[][] = [];
    for (let i = 0; i < n / 2; i++) {
      let pair = [ids[i], ids[n - 1 - i]];
      if ((round + i + cycle) % 2) pair = pair.reverse();
      if (!pair.includes('bye')) pairs.push(pair);
    }
    return pairs;
  }
  function nextFixture(g: GameState) {
    if (g.phase === 'finished') return null;
    if (g.phase === 'preseason') {
      const i = [-22, -15, -8, -1].indexOf(g.day);
      if (i < 0) return null;
      const opp = clubs.filter((c) => c.league === getClub(g.club).league && c.id !== g.club)[
        (hash(g.club) + i) % (clubs.filter((c) => c.league === getClub(g.club).league).length - 1)
      ].id;
      return i % 2 ? [opp, g.club] : [g.club, opp];
    }
    if (g.phase !== 'regular') {
      const target = g.phase === 'semifinal' ? 2 : 3;
      const s = g.series.find(
        (s) => (s.a === g.club || s.b === g.club) && s.aw < target && s.bw < target,
      );
      return s ? ((s.aw + s.bw) % 2 ? [s.b, s.a] : [s.a, s.b]) : null;
    }
    const f = calendar
      .ownFixtures(g)
      .find((f) => !g.history.some((m) => m.fixtureId === f.id && m.date === f.date));
    return f ? [f.home, f.away] : null;
  }
  return {
    ...calendar,
    catalogVersion: world.version,
    clubs,
    leagues,
    getClub,
    getLeague,
    rosterNote,
    get realRosters() {
      return (realRosters ??= Object.fromEntries(
        clubs.map((c) => [c.id, baseRoster(c.id).filter((p) => p.real)]),
      ));
    },
    baseRoster,
    coachPool,
    agentFor,
    marketPlayers,
    rosterFor,
    standings,
    pairings,
    nextFixture,
  };
}
