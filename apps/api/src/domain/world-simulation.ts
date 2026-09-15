import type { GameState, Player, Result, WorldCatalog } from '@dugout/shared/types';
import { packStats, statKeys, subtractStats, isAvailable } from '@dugout/shared/long-term';
import type { PlayerCareerRecord, WorldEvent } from '@dugout/shared/long-term';
import {
  createGameView,
  blankStats,
  hash,
  lineupAuto,
  overall,
  rng,
  teamBudget,
} from '@dugout/shared/game-view';
import { createTransferMarket } from './transfer-market';
import { createPlayerGenerator } from './player-generator';
import { gameDate } from '@dugout/shared/calendar';
import { managerAbility, managerDevelopmentFactor } from '@dugout/shared/manager-ability';
import { postNews } from './club-dynamics';

export function prepareWorld(g: GameState) {
  g.simulation ??= {
    version: 1,
    revision: 0,
    serial: 0,
    players: {},
    retired: [],
    clubs: {},
    events: [],
  };
}
export function saveWorldPlayer(g: GameState, p: Player, generated = false) {
  prepareWorld(g);
  const prior = g.simulation!.players[p.id];
  g.simulation!.players[p.id] = {
    stats: packStats(p.stats),
    reserve: p.reserveStats && packStats(p.reserveStats),
    ratings: [p.contact, p.power, p.speed, p.field, p.stuff, p.control].map(
      (n) => Math.round(n * 100) / 100,
    ),
    age: p.age,
    salary: p.salary,
    years: p.years,
    condition: p.condition,
    stint: p.careerBaseline,
    personality: p.personality,
    remodel: p.remodel,
    generated:
      prior?.generated ||
      (generated
        ? {
            name: p.name,
            pos: p.pos,
            country: p.country,
            number: p.number,
            potential: p.potential,
            born: g.year - p.age,
          }
        : undefined),
  };
  g.ownership[p.id] = p.club;
  if (generated && !prior) g.simulation!.revision++;
}
export function worldEvent(g: GameState, event: Omit<WorldEvent, 'id' | 'date'>) {
  prepareWorld(g);
  g.simulation!.events.unshift({
    ...event,
    id: `world-${g.simulation!.serial++}`,
    date: gameDate(g),
  });
  g.simulation!.events = g.simulation!.events.slice(0, 100);
}
export function archivePlayer(
  g: GameState,
  p: Player,
  kind: PlayerCareerRecord['kind'],
  awards: string[] = [],
  destination?: string,
) {
  prepareWorld(g);
  const baseline = p.careerBaseline?.year === g.year ? p.careerBaseline : undefined;
  const record: PlayerCareerRecord = {
    id: `record-${g.simulation!.serial++}`,
    playerId: p.id,
    name: p.name,
    pos: p.pos,
    country: p.country,
    year: g.year,
    club: p.club,
    from: baseline?.date || `${g.year}-01-01`,
    date: gameDate(g),
    kind,
    stats: subtractStats(p.stats, baseline?.stats),
    reserveStats: subtractStats(p.reserveStats || blankStats(), baseline?.reserve),
    awards,
    destination,
  };
  if (kind === 'retirement')
    record.coach = {
      id: `retired-${p.id}`,
      name: p.name,
      role: p.pos === 'P' ? '투수' : '타격',
      skill: Math.max(
        40,
        Math.min(90, Math.round(overall(p) * 0.55 + Math.min(25, p.age - 18) + (hash(p.id) % 12))),
      ),
      salary: Math.max(1, Math.round(p.salary * 0.05)),
      style: p.pos === 'P' ? '투수 육성' : '유망주 육성',
      real: p.real,
      sourceClub: p.club,
    };
  (g.pendingRecords ??= []).push(record);
  p.careerBaseline = {
    year: g.year,
    club: destination || p.club,
    date: gameDate(g),
    stats: packStats(p.stats),
    reserve: packStats(p.reserveStats || blankStats()),
  };
}

export function createWorldSimulation(world: WorldCatalog) {
  const view = createGameView(world),
    market = createTransferMarket(world),
    generator = createPlayerGenerator(world);
  const catalogIds = new Set(world.players.map((p) => p.id));
  const roster = (g: GameState, club: string) => view.rosterFor(g, club);
  function clubState(g: GameState, club: string) {
    prepareWorld(g);
    return (g.simulation!.clubs[club] ??= {
      balance: teamBudget(view.getClub(club).league),
      strategy: hash(club) % 3 ? 'contend' : 'develop',
    });
  }
  function commit(g: GameState, p: Player) {
    if (g.roster.some((own) => own.id === p.id)) return;
    const transferred = g.transferred.find((saved) => saved.id === p.id);
    if (transferred) Object.assign(transferred, p);
    saveWorldPlayer(g, p, !catalogIds.has(p.id));
  }
  /** Score-consistent lightweight box scores for AI fixtures, using a separate deterministic stream. */
  function recordGame(g: GameState, res: Result) {
    if (!g.simulation || res.friendly || res.post) return;
    const random = rng(hash(`${res.id}:box`));
    for (const [club, against, score, allowed] of [
      [res.home, res.away, res.homeScore, res.awayScore],
      [res.away, res.home, res.awayScore, res.homeScore],
    ] as const) {
      if (club === g.club) continue;
      const players = roster(g, club).filter((p) => p.squad !== 'reserve' && isAvailable(p)),
        batters = lineupAuto(players)
          .map((id) => players.find((p) => p.id === id)!)
          .filter(Boolean);
      if (batters.length !== 9) continue;
      const hits = Math.min(24, Math.max(score, score + Math.floor(random() * 7) - 2));
      const batting = batters.map(() => ({ ...blankStats(), ab: 3, g: 1 }));
      for (let i = 0; i < 9 + hits; i++) batting[i % 9].ab++;
      const choose = () => {
        const weights = batters.map((p) => Math.max(5, p.contact));
        let n = random() * weights.reduce((a, b) => a + b, 0);
        return weights.findIndex((w) => (n -= w) <= 0);
      };
      for (let i = 0; i < hits; i++) {
        const index = Math.max(0, choose());
        if (batting[index].h < batting[index].ab) batting[index].h++;
        else batting.find((s) => s.h < s.ab)!.h++;
      }
      for (let i = 0; i < score; i++) batting[Math.max(0, choose())].rbi++;
      for (let i = 0; i < Math.min(score, Math.floor(random() * 3)); i++) {
        const hitter = batting.find((s) => s.h > s.hr);
        if (hitter) hitter.hr++;
      }
      batting.forEach((s, i) => {
        s.bb = random() < 0.4 ? 1 : 0;
        s.k = Math.min(s.ab - s.h, Math.floor(random() * 3));
        for (const key of statKeys)
          batters[i].stats[key] = (batters[i].stats[key] || 0) + (s[key] || 0);
        commit(g, batters[i]);
      });
      const pitchers = players
        .filter((p) => p.pos === 'P')
        .sort((a, b) => b.stuff - a.stuff || a.id.localeCompare(b.id));
      if (pitchers.length) {
        const starter = pitchers[Math.floor(Math.max(0, g.day) / 2) % Math.min(5, pitchers.length)];
        const reliever = pitchers.find((p) => p.id !== starter.id) || starter;
        const earned = Math.max(0, allowed - (random() < 0.15 ? 1 : 0));
        for (const [p, outs, er] of [
          [starter, 18, Math.min(earned, Math.round(earned * 0.7))],
          [reliever, 9, earned - Math.min(earned, Math.round(earned * 0.7))],
        ] as const) {
          p.stats.g++;
          p.stats.outs += outs;
          p.stats.er += er;
          p.stats.k += Math.floor(outs / 5 + random() * 3);
          p.stats.bb += Math.floor(random() * 3);
        }
        if (score > allowed) starter.stats.wins++;
        if (score > allowed && score - allowed <= 3 && starter !== reliever)
          reliever.stats.saves = (reliever.stats.saves || 0) + 1;
        commit(g, starter);
        commit(g, reliever);
      }
      const finances = clubState(g, club);
      finances.balance +=
        teamBudget(view.getClub(club).league) * (res.home === club ? 0.02 : 0.004);
      void against;
    }
  }
  function move(g: GameState, p: Player, destination: string, fee: number) {
    const previous = p.club;
    archivePlayer(g, p, 'transfer', [], destination);
    p.club = destination;
    commit(g, p);
    g.simulation!.revision++;
    if (previous !== 'fa') clubState(g, previous).balance += fee;
    clubState(g, destination).balance -= fee;
    worldEvent(g, {
      kind: 'transfer',
      club: destination,
      otherClub: previous,
      playerId: p.id,
      text: `${p.name} · ${view.getClub(destination).name} 영입`,
    });
  }
  function tick(g: GameState) {
    prepareWorld(g);
    if (g.simulation!.lastTick === gameDate(g)) return;
    g.simulation!.lastTick = gameDate(g);
    if (g.day % 7 !== 0) return;
    const unavailable = new Set(
      g.deals
        .filter((d) => !['withdrawn', 'expired', 'rejected'].includes(d.status))
        .map((d) => d.player.id),
    );
    for (const trade of g.trades || [])
      if (['pending', 'accepted', 'counter'].includes(trade.status))
        trade.incoming.forEach((id) => unavailable.add(id));
    for (const listing of g.deadlineMarket?.listings || [])
      if (listing.status === 'open') {
        unavailable.add(listing.player.id);
        unavailable.add(listing.rival.player.id);
      }
    const all = view.marketPlayers(g);
    // 구단마다 한 번만 찾아 두고 재사용한다. 주간 성장은 전 리그 선수를 훑는다.
    const developmentFactors = new Map<string, number>();
    const developmentFactor = (club: string) => {
      let factor = developmentFactors.get(club);
      if (factor === undefined) {
        const job = g.managerJobs?.[club];
        const person =
          job && !job.vacant && job.managerId ? g.managerPeople?.[job.managerId] : undefined;
        factor = managerDevelopmentFactor(person && managerAbility(person));
        developmentFactors.set(club, factor);
      }
      return factor;
    };
    for (const p of all) {
      if (p.club === 'fa') continue;
      const base =
        p.age < 25
          ? Math.max(0, p.potential - overall(p)) * 0.0006
          : p.age >= 33
            ? -0.05 * (p.age - 32)
            : 0;
      // 성장은 배로 빨라지고 하락은 배로 느려지도록 같은 배율을 반대로 건다.
      const factor = base ? developmentFactor(p.club) : 1;
      const growth = base > 0 ? base * factor : base / factor;
      if (growth) {
        for (const key of ['contact', 'power', 'speed', 'field', 'stuff', 'control'] as const)
          p[key] = Math.max(15, Math.min(99, p[key] + growth));
        commit(g, p);
      }
    }
    // Bounded weekly market: one independent deal per league, never involving the user's club.
    for (const league of world.leagues) {
      const candidates = world.clubs.filter((c) => c.league === league.id && c.id !== g.club);
      if (!candidates.length) continue;
      const club = candidates[hash(`${g.year}:${g.day}:${league.id}`) % candidates.length];
      const team = roster(g, club.id);
      const weak =
        [...team].sort((a, b) => overall(a) - overall(b)).find((p) => p.age > 26) || team[0];
      if (!weak || team.length >= 40 || market.closed(g, club.id)) continue;
      const candidate = all
        .filter(
          (p) =>
            p.club !== club.id &&
            p.club !== g.club &&
            !unavailable.has(p.id) &&
            p.pos === weak.pos &&
            (p.club === 'fa' || view.getClub(p.club)?.league === league.id),
        )
        .filter((p) => p.club === 'fa' || !market.closed(g, p.club))
        .filter(
          (p) =>
            p.club === 'fa' ||
            roster(g, p.club).filter((x) => x.pos === p.pos).length >
              { P: 7, C: 2, IF: 6, OF: 4, DH: 1 }[p.pos],
        )
        .filter(
          (p) =>
            overall(p) > overall(weak) + 3 ||
            (clubState(g, club.id).strategy === 'develop' && p.age <= 23),
        )
        .sort(
          (a, b) =>
            overall(b) - b.salary * 0.1 - (overall(a) - a.salary * 0.1) || a.id.localeCompare(b.id),
        )[0];
      if (!candidate) continue;
      const fee = candidate.club === 'fa' ? 0 : Math.max(2, candidate.salary * 1.5);
      if (clubState(g, club.id).balance < fee + candidate.salary) continue;
      move(g, candidate, club.id, fee);
      unavailable.add(candidate.id);
    }
  }
  function finishSeason(g: GameState) {
    prepareWorld(g);
    if (g.simulation!.archivedYear === g.year) return;
    const players = [...g.roster, ...view.marketPlayers(g)];
    const awards = new Map<string, string[]>();
    for (const league of world.leagues) {
      const eligible = players.filter((p) => view.getClub(p.club)?.league === league.id);
      for (const [label, score] of [
        [
          '최우수 타자',
          (p: Player) =>
            p.pos !== 'P' && p.stats.ab >= 20 ? p.stats.h + p.stats.hr * 3 + p.stats.rbi : -1,
        ],
        [
          '최우수 투수',
          (p: Player) =>
            p.pos === 'P' && p.stats.outs >= 30
              ? p.stats.outs - p.stats.er * 3 + p.stats.wins * 8
              : -1,
        ],
        [
          '신인상',
          (p: Player) =>
            p.age <= 23 && p.stats.g >= 5
              ? p.stats.h + p.stats.hr * 3 + p.stats.outs / 3 - p.stats.er
              : -1,
        ],
      ] as const) {
        const winner = eligible
          .filter((p) => score(p) >= 0)
          .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
        if (winner)
          awards.set(winner.id, [...(awards.get(winner.id) || []), `${league.name} ${label}`]);
      }
    }
    for (const p of players) {
      const retires =
        p.age >= 43 || (p.age >= 36 && hash(`${p.id}:${g.year}:retire`) % 100 < (p.age - 35) * 8);
      archivePlayer(g, p, retires ? 'retirement' : 'season', awards.get(p.id) || []);
      if (retires) {
        if (catalogIds.has(p.id)) g.simulation!.retired.push(p.id);
        delete g.simulation!.players[p.id];
        delete g.ownership[p.id];
        g.roster = g.roster.filter((x) => x.id !== p.id);
        g.transferred = g.transferred.filter((x) => x.id !== p.id);
        worldEvent(g, {
          kind: 'retirement',
          club: p.club,
          playerId: p.id,
          text: `${p.name} 은퇴 · 코치 지원 가능`,
        });
        if (p.club === g.club)
          postNews(
            g,
            `${p.name} 현역 은퇴`,
            '통산 기록을 보관했습니다. 기록 보관함에서 코치로 영입할 수 있습니다.',
            'contract',
            { playerId: p.id },
          );
      } else if (p.club !== g.club) {
        p.age++;
        p.years = Math.max(1, p.years - 1);
        p.stats = blankStats();
        p.reserveStats = blankStats();
        p.condition = 100;
        delete p.careerBaseline;
        commit(g, p);
      } else delete p.careerBaseline;
    }
    // Keep every AI club playable as veterans retire. These are generated youth signings.
    for (const club of world.clubs.filter((c) => c.id !== g.club)) {
      const team = roster(g, club.id);
      for (const [pos, min] of [
        ['P', 9],
        ['C', 2],
        ['IF', 6],
        ['OF', 4],
        ['DH', 1],
      ] as const) {
        for (let n = team.filter((p) => p.pos === pos).length; n < min; n++) {
          const serial = g.simulation!.serial++,
            p = generator.makePlayer(club.id, 7000 + serial, undefined, g.year + 1);
          p.id = `academy-${club.id}-${g.year + 1}-${serial}`;
          p.pos = pos;
          p.age = 18 + (serial % 4);
          p.years = 3;
          p.salary = Math.max(1, Math.round(teamBudget(club.league) * 0.0004));
          if (pos === 'P') {
            p.stuff = p.contact;
            p.control = p.field;
          }
          // born is based on the next season although the archive is still being closed.
          saveWorldPlayer(g, p, true);
          g.simulation!.players[p.id].generated!.born = g.year + 1 - p.age;
          team.push(p);
        }
      }
    }
    g.simulation!.archivedYear = g.year;
    g.simulation!.revision++;
  }
  return { tick, recordGame, finishSeason, commit, move };
}
