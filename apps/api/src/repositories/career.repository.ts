import { Injectable } from '@nestjs/common';
import { careerProjections } from './career-projections';
import type { GameState, WorldCatalog, FinanceEntry, Result } from '@dugout/shared/types';

type CareerRow = { state: string; revision: number };
@Injectable()
export class CareerRepository {
  async catalogKnowledge(db: D1Database, user: string) {
    const row = await db
      .prepare(
        "SELECT json_object('club',json_extract(state,'$.club'),'rules',json_extract(state,'$.rules'),'knowledge',json_extract(state,'$.knowledge'),'scouting',json_extract(state,'$.scouting')) AS visibility FROM careers WHERE user_id=?",
      )
      .bind(user)
      .first<{ visibility: string }>();
    return row
      ? (JSON.parse(row.visibility) as Pick<GameState, 'club' | 'rules' | 'knowledge' | 'scouting'>)
      : null;
  }
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
    return (await this.snapshot(db, user)).current;
  }
  async actionSnapshot(db: D1Database, user: string, requestId: string) {
    return this.snapshot(db, user, requestId);
  }
  private async snapshot(db: D1Database, user: string, requestId?: string) {
    // Three bounded, indexed reads share one D1 round trip and one consistent snapshot.
    const statements = [
      db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user),
      db
        .prepare(
          'SELECT id,revision,season AS year,day,kind,amount,balance,created_at AS createdAt FROM finance_entries WHERE user_id=? ORDER BY revision DESC LIMIT 60',
        )
        .bind(user),
    ];
    if (requestId)
      statements.push(
        db
          .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
          .bind(user, requestId),
      );
    const results = await db.batch(statements);
    const row = results[0].results[0] as CareerRow | undefined;
    return {
      current: {
        state: row ? (JSON.parse(row.state) as GameState) : null,
        revision: row?.revision || 0,
        ledger: results[1].results as FinanceEntry[],
      },
      seen: !!results[2]?.results.length,
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
    priorLedger?: FinanceEntry[],
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
      return { state, revision, ledger: priorLedger ?? (await this.ledger(db, user)) };
    }
    const previous = new Map(
      before && !resetting ? careerProjections(before, world).map((p) => [p.table, p]) : [],
    );
    for (const projection of careerProjections(state, world)) {
      const { table, key, fields, rows } = projection;
      const prior = new Map((previous.get(table)?.rows || []).map((row) => [row[key], row]));
      const current = new Set(rows.map((row) => row[key]));
      if (resetting) clear(table);
      else {
        const removed = [...prior.keys()].filter((id) => !current.has(id));
        if (removed.length)
          statements.push(
            db
              .prepare(
                `DELETE FROM ${table} WHERE user_id=? AND ${key} IN (SELECT value FROM json_each(?)) AND ${guard}`,
              )
              .bind(user, JSON.stringify(removed), user, token),
          );
      }
      const changed = rows.filter(
        (row) => JSON.stringify(row) !== JSON.stringify(prior.get(row[key])),
      );
      if (!changed.length) continue;
      const extracts = fields.map((field) => `json_extract(value,'$.${field}')`).join(',');
      const updates = fields
        .filter((field) => field !== key)
        .map((field) => `${field}=excluded.${field}`)
        .join(',');
      statements.push(
        db
          .prepare(
            `INSERT INTO ${table}(user_id,${fields.join(',')}) SELECT ?,${extracts} FROM json_each(?) WHERE ${guard} ON CONFLICT(user_id,${key}) DO UPDATE SET ${updates}`,
          )
          .bind(user, JSON.stringify(changed), user, token),
      );
    }
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
    const entry: FinanceEntry = {
      id: `${user}:${revision}`,
      revision,
      year: state.year,
      day: state.day,
      kind,
      amount,
      balance: state.budget,
      createdAt: now,
    };
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
    const ledger = resetting ? [] : priorLedger;
    return {
      state,
      revision,
      ledger: ledger
        ? amount
          ? [entry, ...ledger].slice(0, 60)
          : ledger
        : await this.ledger(db, user),
    };
  }
}
