import { careerTables, exportCareer } from './career-backup';

export { careerTables, exportCareer };

export type CareerTable = (typeof careerTables)[number];
type ColumnType = 'text' | 'integer' | 'real';
type Column = { name: string; type: ColumnType; nullable?: boolean };
type Row = Record<string, string | number | null>;

const text = (name: string, nullable = false): Column => ({ name, type: 'text', nullable });
const integer = (name: string): Column => ({ name, type: 'integer' });
const real = (name: string): Column => ({ name, type: 'real' });

/**
 * Fixed column whitelist mirroring apps/api/db/schema.ts after migration 0011.
 * The live database is cross-checked against it with PRAGMA table_info before any write.
 */
export const careerColumns: Record<CareerTable, readonly Column[]> = {
  careers: [
    text('user_id'),
    text('state'),
    integer('revision'),
    text('updated_at'),
    text('write_token'),
  ],
  career_players: [
    text('user_id'),
    text('player_id'),
    text('club_id'),
    text('position'),
    text('name'),
    text('data'),
  ],
  contracts: [
    text('user_id'),
    text('player_id'),
    text('club_id'),
    real('salary'),
    integer('years'),
    integer('season'),
    text('agent_id'),
  ],
  career_staff: [
    text('user_id'),
    text('role'),
    text('coach_id'),
    text('name'),
    integer('skill'),
    real('salary'),
    text('style'),
    integer('is_real'),
    text('source_club', true),
    text('source', true),
    text('verified_role', true),
  ],
  negotiations: [
    text('user_id'),
    text('deal_id'),
    text('player_id'),
    text('status'),
    real('salary'),
    integer('years'),
    text('data'),
  ],
  career_standings: [
    text('user_id'),
    text('club_id'),
    text('league_id'),
    integer('season'),
    integer('wins'),
    integer('losses'),
    integer('draws'),
    integer('runs_for'),
    integer('runs_against'),
  ],
  career_matches: [
    text('user_id'),
    text('match_id'),
    integer('season'),
    integer('day'),
    text('home'),
    text('away'),
    integer('home_score'),
    integer('away_score'),
    text('data'),
  ],
  transfers: [
    text('id'),
    text('user_id'),
    text('player_id'),
    text('player_name'),
    text('from_club'),
    text('to_club'),
    text('kind'),
    integer('season'),
    integer('day'),
    integer('revision'),
  ],
  finance_entries: [
    text('id'),
    text('user_id'),
    integer('revision'),
    integer('season'),
    integer('day'),
    text('kind'),
    real('amount'),
    real('balance'),
    text('created_at'),
  ],
  career_actions: [
    text('user_id'),
    integer('revision'),
    text('kind'),
    text('request_id'),
    text('created_at'),
  ],
};

export type CareerImportCode =
  'invalid_backup' | 'schema_mismatch' | 'target_exists' | 'id_conflict' | 'verification_failed';

export class CareerImportError extends Error {
  constructor(
    public readonly code: CareerImportCode,
    message: string,
  ) {
    super(message);
    this.name = 'CareerImportError';
  }
}

export type CareerImportResult = {
  format: 'dugout-career-backup-v1';
  sourceUserId: string;
  targetUserId: string;
  counts: Record<CareerTable, number>;
  statements: number;
};

const FORMAT = 'dugout-career-backup-v1';
/** D1 accepts at most 100 bound parameters per statement. */
const MAX_BINDS = 100;

const invalid = (message: string) => new CareerImportError('invalid_backup', message);
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkValue(table: string, index: number, column: Column, value: unknown) {
  const where = `${table}[${index}].${column.name}`;
  if (value === null) {
    if (column.nullable) return;
    throw invalid(`${where} 값이 비어 있습니다.`);
  }
  if (column.type === 'text') {
    if (typeof value !== 'string') throw invalid(`${where} 값은 문자열이어야 합니다.`);
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw invalid(`${where} 값은 숫자여야 합니다.`);
  if (column.type === 'integer' && !Number.isInteger(value))
    throw invalid(`${where} 값은 정수여야 합니다.`);
}

/** Structural validation only. Ownership and the target are checked separately. */
function parseBackup(backup: unknown) {
  if (!isPlainObject(backup)) throw invalid('백업 파일 형식이 올바르지 않습니다.');
  if (backup.format !== FORMAT) throw invalid('지원하지 않는 백업 형식입니다.');
  const sourceUserId = backup.sourceUserId;
  if (typeof sourceUserId !== 'string' || !sourceUserId)
    throw invalid('백업의 원본 사용자 정보가 없습니다.');
  const tables = backup.tables;
  if (!isPlainObject(tables)) throw invalid('백업에 테이블 데이터가 없습니다.');
  const unknownTables = Object.keys(tables).filter(
    (name) => !(careerTables as readonly string[]).includes(name),
  );
  if (unknownTables.length)
    throw invalid(`허용되지 않은 테이블이 포함되어 있습니다: ${unknownTables.join(', ')}`);
  const rows = {} as Record<CareerTable, Row[]>;
  for (const table of careerTables) {
    const list = tables[table];
    if (!Array.isArray(list)) throw invalid(`${table} 테이블 데이터가 배열이 아닙니다.`);
    const columns = careerColumns[table];
    const names = new Set(columns.map((c) => c.name));
    rows[table] = list.map((row, index) => {
      if (!isPlainObject(row)) throw invalid(`${table}[${index}] 행 형식이 올바르지 않습니다.`);
      const keys = Object.keys(row);
      const unknownColumns = keys.filter((key) => !names.has(key));
      if (unknownColumns.length)
        throw invalid(
          `${table}[${index}]에 허용되지 않은 컬럼이 있습니다: ${unknownColumns.join(', ')}`,
        );
      if (keys.length !== columns.length)
        throw invalid(`${table}[${index}] 행에 누락된 컬럼이 있습니다.`);
      for (const column of columns) checkValue(table, index, column, row[column.name]);
      if (row.user_id !== sourceUserId)
        throw invalid(`${table}[${index}] 행이 다른 사용자의 데이터입니다.`);
      return row as Row;
    });
  }
  if (rows.careers.length !== 1) throw invalid('백업에는 커리어가 정확히 하나 있어야 합니다.');
  return { sourceUserId, rows };
}

type TableInfo = { name: string; type: string; notnull: number };

/** Refuse to write when the live schema drifted from the whitelist in either direction. */
async function assertSchema(db: D1Database) {
  const infos = await db.batch<TableInfo>(
    careerTables.map((table) => db.prepare(`PRAGMA table_info(${table})`)),
  );
  careerTables.forEach((table, index) => {
    const live = new Map(infos[index].results.map((c) => [c.name, c]));
    const expected = careerColumns[table];
    const mismatch = (detail: string) =>
      new CareerImportError('schema_mismatch', `${table} 스키마가 예상과 다릅니다: ${detail}`);
    if (live.size !== expected.length) throw mismatch('컬럼 수');
    for (const column of expected) {
      const actual = live.get(column.name);
      if (!actual) throw mismatch(`${column.name} 없음`);
      if (actual.type.toLowerCase() !== column.type) throw mismatch(`${column.name} 타입`);
      if (Boolean(actual.notnull) !== !column.nullable) throw mismatch(`${column.name} NULL 허용`);
    }
  });
}

const canonical = (table: CareerTable, rows: Row[]) =>
  rows
    .map((row) => JSON.stringify(careerColumns[table].map((c) => row[c.name])))
    .sort()
    .join('\n');

/**
 * Restore a dugout-career-backup-v1 export for `targetUserId` in one atomic D1 batch.
 * Every value except `user_id` is written exactly as exported; an existing target career is never
 * touched because the very first statement is a plain INSERT into the `careers` primary key.
 */
export async function importCareer(
  db: D1Database,
  backup: unknown,
  targetUserId: string,
): Promise<CareerImportResult> {
  if (typeof targetUserId !== 'string' || !targetUserId)
    throw invalid('가져올 대상 사용자가 지정되지 않았습니다.');
  const { sourceUserId, rows } = parseBackup(backup);
  await assertSchema(db);

  const existing = await db.batch<{ n: number }>(
    careerTables.map((table) =>
      db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).bind(targetUserId),
    ),
  );
  if (existing.some((result) => (result.results[0]?.n ?? 0) > 0))
    throw new CareerImportError('target_exists', '이미 저장된 커리어가 있어 가져올 수 없습니다.');

  const mapped = {} as Record<CareerTable, Row[]>;
  for (const table of careerTables)
    mapped[table] = rows[table].map((row) => ({ ...row, user_id: targetUserId }));

  const statements: D1PreparedStatement[] = [];
  for (const table of careerTables) {
    const columns = careerColumns[table];
    const names = columns.map((c) => c.name).join(',');
    const placeholders = `(${columns.map(() => '?').join(',')})`;
    const perStatement = Math.max(1, Math.floor(MAX_BINDS / columns.length));
    const list = mapped[table];
    for (let start = 0; start < list.length; start += perStatement) {
      const chunk = list.slice(start, start + perStatement);
      statements.push(
        db
          .prepare(
            `INSERT INTO ${table}(${names}) VALUES ${chunk.map(() => placeholders).join(',')}`,
          )
          .bind(...chunk.flatMap((row) => columns.map((c) => row[c.name]))),
      );
    }
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE constraint failed: careers.user_id'))
      throw new CareerImportError('target_exists', '이미 저장된 커리어가 있어 가져올 수 없습니다.');
    // transfers.id / finance_entries.id embed the source user id and are preserved verbatim,
    // so the same backup can be restored only once per database.
    if (/UNIQUE constraint failed: (transfers|finance_entries)\.id/.test(message))
      throw new CareerImportError(
        'id_conflict',
        '이 백업의 이적·재무 기록이 이미 데이터베이스에 있어 가져올 수 없습니다.',
      );
    throw error;
  }

  const restored = await exportCareer(db, targetUserId);
  const counts = {} as Record<CareerTable, number>;
  for (const table of careerTables) {
    const actual = restored.tables[table] as Row[];
    if (canonical(table, actual) !== canonical(table, mapped[table]))
      throw new CareerImportError(
        'verification_failed',
        `${table} 테이블이 원본과 다르게 저장되었습니다.`,
      );
    counts[table] = actual.length;
  }
  return {
    format: FORMAT,
    sourceUserId,
    targetUserId,
    counts,
    statements: statements.length,
  };
}
