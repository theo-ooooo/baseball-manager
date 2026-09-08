import { createGameView } from '@dugout/shared/game-view';
import type { GameState, WorldCatalog } from '@dugout/shared/types';

export type Projection = {
  table: string;
  key: string;
  fields: string[];
  rows: Record<string, unknown>[];
};

/** Only durable relational columns participate in change detection. */
export function careerProjections(state: GameState, world: WorldCatalog): Projection[] {
  const { agentFor } = createGameView(world);
  const groups: Projection[] = [];
  const add = (table: string, fields: string[], rows: Record<string, unknown>[]) => {
    groups.push({ table, key: fields[0], fields, rows });
  };
  const allPlayers = [
    ...new Map([...state.transferred, ...state.roster].map((p) => [p.id, p])).values(),
  ];
  add(
    'career_players',
    ['player_id', 'club_id', 'position', 'name', 'data'],
    allPlayers.map((p) => ({
      player_id: p.id,
      club_id: p.club,
      position: p.pos,
      name: p.name,
      data: JSON.stringify(p),
    })),
  );
  add(
    'contracts',
    ['player_id', 'club_id', 'salary', 'years', 'season', 'agent_id'],
    allPlayers
      .filter((p) => p.club !== 'fa')
      .map((p) => ({
        player_id: p.id,
        club_id: p.club,
        salary: p.salary,
        years: p.years,
        season: state.year,
        agent_id: agentFor(p).id,
      })),
  );
  add(
    'career_staff',
    [
      'role',
      'coach_id',
      'name',
      'skill',
      'salary',
      'style',
      'is_real',
      'source_club',
      'source',
      'verified_role',
    ],
    state.staff.map((c) => ({
      role: c.role,
      coach_id: c.id,
      name: c.name,
      skill: c.skill,
      salary: c.salary,
      style: c.style,
      is_real: c.real ? 1 : 0,
      source_club: c.sourceClub || null,
      source: c.source || null,
      verified_role: c.verifiedRole || null,
    })),
  );
  add(
    'negotiations',
    ['deal_id', 'player_id', 'status', 'salary', 'years', 'data'],
    state.deals.map((d) => ({
      deal_id: d.id,
      player_id: d.player.id,
      status: d.status,
      salary: d.salary,
      years: d.years,
      data: JSON.stringify(d),
    })),
  );
  add(
    'career_standings',
    ['club_id', 'league_id', 'season', 'wins', 'losses', 'draws', 'runs_for', 'runs_against'],
    Object.entries(state.standings).flatMap(([league, rows]) =>
      rows.map((s) => ({
        club_id: s.club,
        league_id: league,
        season: state.year,
        wins: s.w,
        losses: s.l,
        draws: s.d,
        runs_for: s.rf,
        runs_against: s.ra,
      })),
    ),
  );
  return groups;
}
