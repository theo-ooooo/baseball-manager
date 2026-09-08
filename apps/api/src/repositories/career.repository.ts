import { Injectable } from '@nestjs/common';
import { createGameView } from '@dugout/shared/game-view';
import type { GameState, WorldCatalog, FinanceEntry, Result } from '@dugout/shared/types';

type CareerRow = { state: string; revision: number };
@Injectable()
export class CareerRepository {
  async revealsPotential(db: D1Database, user: string) {
    const row = await db
      .prepare(
        "SELECT json_extract(state,'$.rules.revealPotential') AS reveal FROM careers WHERE user_id=?",
      )
      .bind(user)
      .first<{ reveal: number | null }>();
    return row?.reveal === 1;
  }
  async read(db: D1Database, user: string) {
    const row = await db
      .prepare('SELECT state,revision FROM careers WHERE user_id=?')
      .bind(user)
      .first<CareerRow>();
    return {
      state: row ? (JSON.parse(row.state) as GameState) : null,
      revision: row?.revision || 0,
      ledger: await this.ledger(db, user),
    };
  }
  async ledger(db: D1Database, user: string): Promise<FinanceEntry[]> {
    const rows = await db
      .prepare(
        'SELECT id,revision,season AS year,day,kind,amount,balance,created_at AS createdAt FROM finance_entries WHERE user_id=? ORDER BY revision DESC LIMIT 60',
      )
      .bind(user)
      .all<FinanceEntry>();
    return rows.results;
  }
  async match(db: D1Database, user: string, id: string): Promise<Result | null> {
    const row = await db
      .prepare('SELECT data FROM career_matches WHERE user_id=? AND match_id=?')
      .bind(user, id)
      .first<{ data: string }>();
    return row ? JSON.parse(row.data) : null;
  }
  async seenRequest(db: D1Database, user: string, requestId: string) {
    return !!(await db
      .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
      .bind(user, requestId)
      .first());
  }

  /** Snapshot, relational state, archives and accounting commit in one D1 transaction. */
  async save(
    db: D1Database,
    user: string,
    expected: number,
    before: GameState | null,
    next: GameState,
    world: WorldCatalog,
    kind: string,
    requestId: string,
  ) {
    const token = crypto.randomUUID(),
      now = new Date().toISOString(),
      revision = expected + 1;
    const resetting = kind === 'start';
    const previousMatches = new Set(resetting ? [] : before?.history.map((m) => m.id) || []);
    const newMatches = next.history.filter((m) => !previousMatches.has(m.id));
    // Full play-by-play belongs in the match archive; keep only five logs in the hot save.
    const state: GameState = {
      ...next,
      history: next.history.map((m, i) => (i < 5 ? m : { ...m, log: [], replayTeams: undefined })),
    };
    const serialized = JSON.stringify(state);
    if (serialized.length > 1_800_000) throw new Error('커리어 저장 용량을 초과했습니다.');
    const statements: D1PreparedStatement[] = [];
    if (before) {
      statements.push(
        db
          .prepare(
            'UPDATE careers SET state=?,revision=revision+1,updated_at=?,write_token=? WHERE user_id=? AND revision=?',
          )
          .bind(serialized, now, token, user, expected),
      );
    } else {
      statements.push(
        db
          .prepare(
            'INSERT INTO careers(user_id,state,revision,updated_at,write_token) VALUES(?,?,1,?,?) ON CONFLICT(user_id) DO NOTHING',
          )
          .bind(user, serialized, now, token),
      );
    }
    // If the compare-and-swap loses, every following statement becomes a no-op.
    const guard = 'EXISTS(SELECT 1 FROM careers WHERE user_id=? AND write_token=?)';
    const clear = (table: string) =>
      statements.push(
        db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${guard}`).bind(user, user, token),
      );
    const insert = (
      table: string,
      fields: string[],
      rows: Record<string, unknown>[],
      ignore = false,
    ) => {
      if (!rows.length) return;
      const extracts = fields.map((f) => `json_extract(value,'$.${f}')`).join(',');
      statements.push(
        db
          .prepare(
            `INSERT ${ignore ? 'OR IGNORE ' : ''}INTO ${table}(user_id,${fields.join(',')}) SELECT ?,${extracts} FROM json_each(?) WHERE ${guard}`,
          )
          .bind(user, JSON.stringify(rows), user, token),
      );
    };
    const replace = (table: string, fields: string[], rows: Record<string, unknown>[]) => {
      clear(table);
      insert(table, fields, rows);
    };
    if (resetting)
      for (const table of ['career_matches', 'transfers', 'finance_entries', 'career_actions'])
        clear(table);
    // A PA only changes liveMatch. Keep all projections and accounting intact.
    // Revision and request-id are still committed atomically with the snapshot.
    if (['stepMatch', 'matchCursor', 'prepareMatch'].includes(kind) && before?.liveMatch) {
      insert(
        'career_actions',
        ['revision', 'kind', 'request_id', 'created_at'],
        [{ revision, kind, request_id: requestId, created_at: now }],
      );
      const result = await db.batch(statements);
      if (result[0].meta.changes !== 1) return null;
      return { state, revision, ledger: await this.ledger(db, user) };
    }
    const { agentFor } = createGameView(world);
    const allPlayers = [
      ...new Map([...state.transferred, ...state.roster].map((p) => [p.id, p])).values(),
    ];
    replace(
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
    replace(
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
    replace(
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
    replace(
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
    replace(
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
    insert(
      'career_matches',
      ['match_id', 'season', 'day', 'home', 'away', 'home_score', 'away_score', 'data'],
      newMatches.map((m) => ({
        match_id: m.id,
        season: next.year,
        day: m.day,
        home: m.home,
        away: m.away,
        home_score: m.homeScore,
        away_score: m.awayScore,
        data: JSON.stringify(m),
      })),
      true,
    );
    if (before && !resetting) {
      const prior = new Map(before.roster.map((p) => [p.id, p])),
        current = new Map(state.roster.map((p) => [p.id, p]));
      const changes: Record<string, unknown>[] = [];
      for (const p of before.roster)
        if (!current.has(p.id))
          changes.push({
            id: `${user}:${revision}:out:${p.id}`,
            player_id: p.id,
            player_name: p.name,
            from_club: before.club,
            to_club: state.ownership[p.id] || 'fa',
            kind: kind === 'sell' ? 'sale' : 'expiry',
            season: state.year,
            day: state.day,
            revision,
          });
      for (const p of state.roster)
        if (!prior.has(p.id))
          changes.push({
            id: `${user}:${revision}:in:${p.id}`,
            player_id: p.id,
            player_name: p.name,
            from_club: before.deals.find((d) => d.player.id === p.id)?.player.club || 'youth',
            to_club: state.club,
            kind: kind === 'sign' ? 'signing' : 'youth',
            season: state.year,
            day: state.day,
            revision,
          });
      insert(
        'transfers',
        [
          'id',
          'player_id',
          'player_name',
          'from_club',
          'to_club',
          'kind',
          'season',
          'day',
          'revision',
        ],
        changes,
      );
    }
    const amount = state.budget - (resetting ? 0 : before?.budget || 0);
    if (amount)
      insert(
        'finance_entries',
        ['id', 'revision', 'season', 'day', 'kind', 'amount', 'balance', 'created_at'],
        [
          {
            id: `${user}:${revision}`,
            revision,
            season: state.year,
            day: state.day,
            kind,
            amount,
            balance: state.budget,
            created_at: now,
          },
        ],
      );
    insert(
      'career_actions',
      ['revision', 'kind', 'request_id', 'created_at'],
      [{ revision, kind, request_id: requestId, created_at: now }],
    );
    const result = await db.batch(statements);
    if (result[0].meta.changes !== 1) return null;
    return { state, revision, ledger: await this.ledger(db, user) };
  }
}
