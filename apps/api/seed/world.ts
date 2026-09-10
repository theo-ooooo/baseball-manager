import managers from './club-managers-2026-09-09.json';
import logos from './club-logos.json';
import type { ClubLogo } from '@dugout/shared/types';
import schedule from './schedule-2026.json';
import performance from './performance-2025.json';
import { rateRealPlayers } from '../src/domain/performance-ratings';
import type { PerformanceRecord } from '@dugout/shared/types';
import registration from './kbo-register-2026-09-07.json';
import { clubs, leagues, realRosters, rosterNote } from './catalog';
import { createPlayerGenerator } from '../src/domain/player-generator';
import { blankStats, coachRoles, hash, rng } from '@dugout/shared/game-view';
import type { WorldCatalog, Player, Pos, Coach } from '@dugout/shared/types';

/** Seed input only. Runtime API code reads the catalog from D1. */
export function buildSeedWorld(): WorldCatalog {
  const { makePlayer, generatedName } = createPlayerGenerator({ clubs, leagues });
  const players: Player[] = [];
  const used = new Set<string>();
  for (const club of clubs) {
    const roster = (realRosters[club.id] || []).map((p, i) => makePlayer(club.id, i, p));
    for (const [pos, count] of [
      ['P', 10],
      ['C', 2],
      ['IF', 6],
      ['OF', 4],
      ['DH', 1],
    ] as [Pos, number][]) {
      while (roster.filter((p) => p.pos === pos).length < count) {
        const p = makePlayer(club.id, 100 + roster.length);
        p.pos = pos;
        if (pos === 'P') {
          p.stuff = p.contact;
          p.control = p.field;
        }
        roster.push(p);
      }
    }
    for (let i = 0; i < 3; i++) roster.push(makePlayer(club.id, 200 + i));
    for (const p of roster) {
      // Same-name players in different clubs must not share a database identity.
      if (used.has(p.id)) p.id += '-' + club.id + '-' + p.number;
      used.add(p.id);
      players.push(p);
    }
  }
  for (let i = 0; i < 35; i++) {
    const p = makePlayer('fa', i);
    p.age = 19 + (i % 16);
    p.contact += i % 10;
    p.power += i % 8;
    p.stats = blankStats();
    players.push(p);
  }
  rateRealPlayers(players, performance.records as PerformanceRecord[]);
  const coaches: Coach[] = coachRoles.flatMap((role, i) =>
    Array.from({ length: 4 }, (_, n) => {
      const r = rng(hash(`coach:2026:${i}:${n}`));
      return {
        id: `coach-2026-${i}-${n}`,
        name: generatedName(n % 2 ? '미국 · 캐나다' : '대한민국', r),
        role,
        skill: 58 + n * 10 + Math.floor(r() * 7),
        salary: 12 + n * n * 12,
        style: ['기본기', '유망주 육성', '실전 중심', '데이터 분석'][n],
      };
    }),
  );
  coaches.push(
    ...registration.teams.flatMap((t) =>
      t.coaches.map((c) => ({
        id: `coach-real-${t.club}-${c.number}`,
        name: c.name,
        role: '코치',
        skill: 65 + (hash(t.club + c.name) % 24),
        salary: 30 + (hash(c.name) % 50),
        style: '선수 육성',
        real: true,
        sourceClub: t.club,
        source: registration.source,
        verifiedRole: '코치',
      })),
    ),
  );
  return {
    version: 'world-2026-09-09-v8',
    year: 2026,
    clubs: clubs.map((club) => ({
      ...club,
      manager: (managers as Record<string, WorldCatalog['clubs'][number]['manager']>)[club.id],
      logo: (logos as Record<string, ClubLogo>)[club.id],
    })),
    leagues,
    players,
    coaches,
    rosterNote,
    fixtures: schedule.fixtures,
    agents: [
      {
        id: 'agent-0',
        name: '박준혁',
        agency: 'BASE Sports',
        fee: 0.05,
        priority: '안정적인 장기 계약',
      },
      {
        id: 'agent-1',
        name: 'Daniel Cruz',
        agency: 'Diamond Agency',
        fee: 0.08,
        priority: '연봉 우선',
      },
      { id: 'agent-2', name: '사토 켄지', agency: 'Next Inning', fee: 0.06, priority: '출전 기회' },
      {
        id: 'agent-3',
        name: 'Alex Morgan',
        agency: 'Northstar Sports',
        fee: 0.1,
        priority: '상위 리그 진출',
      },
      { id: 'agent-4', name: '이수민', agency: 'HOME PLATE', fee: 0.04, priority: '선수 성장' },
    ],
  };
}
