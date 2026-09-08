/** Collect D1's own row counts; no estimate based on SQL statement counts. */
export function meteredD1(database) {
  const statements = new WeakMap();
  const calls = [];
  const record = (sql, result) => {
    calls.push({ sql, rowsRead: result.meta.rows_read, rowsWritten: result.meta.rows_written });
    return result;
  };
  function wrap(statement, sql) {
    const wrapped = {
      bind: (...args) => wrap(statement.bind(...args), sql),
      all: async () => record(sql, await statement.all()),
      run: async () => record(sql, await statement.run()),
      first: async (column) => {
        const result = record(sql, await statement.all()).results[0];
        return result ? (column ? result[column] : result) : null;
      },
    };
    statements.set(wrapped, { statement, sql });
    return wrapped;
  }
  return {
    db: {
      prepare: (sql) => wrap(database.prepare(sql), sql),
      batch: async (batch) => {
        const raw = batch.map((s) => statements.get(s));
        const results = await database.batch(raw.map((s) => s.statement));
        return results.map((r, i) => record(raw[i].sql, r));
      },
    },
    reset: () => {
      calls.length = 0;
    },
    calls,
    total: () =>
      calls.reduce(
        (sum, c) => ({
          queries: sum.queries + 1,
          rowsRead: sum.rowsRead + c.rowsRead,
          rowsWritten: sum.rowsWritten + c.rowsWritten,
        }),
        { queries: 0, rowsRead: 0, rowsWritten: 0 },
      ),
  };
}
