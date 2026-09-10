export const careerTables = [
  'careers',
  'career_players',
  'contracts',
  'career_staff',
  'negotiations',
  'career_standings',
  'career_matches',
  'transfers',
  'finance_entries',
  'career_actions',
  'career_player_records',
] as const;

/** Read the original persisted values in one D1 batch without presentation masking. */
export async function exportCareer(db: D1Database, userId: string) {
  const results = await db.batch(
    careerTables.map((table) => db.prepare(`SELECT * FROM ${table} WHERE user_id=?`).bind(userId)),
  );
  return {
    format: 'dugout-career-backup-v1',
    sourceUserId: userId,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(careerTables.map((table, index) => [table, results[index].results])),
  };
}
