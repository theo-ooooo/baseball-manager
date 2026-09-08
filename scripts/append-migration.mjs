import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Append only: published migrations and their timestamps are immutable. */
export function appendMigration(name, sql, snapshot) {
  if (!/^[a-z][a-z0-9_]+$/.test(name)) throw new Error('Invalid migration name');
  const journalPath = 'drizzle/meta/_journal.json';
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (journal.entries.some(e => e.tag.endsWith('_' + name))) throw new Error('Migration already exists: ' + name);
  const last = journal.entries.at(-1), idx = last.idx + 1;
  const number = String(idx).padStart(4, '0'), tag = number + '_' + name;
  const sqlPath = 'drizzle/' + tag + '.sql', snapshotPath = 'drizzle/meta/' + number + '_snapshot.json';
  if (existsSync(sqlPath) || existsSync(snapshotPath)) throw new Error('Migration destination already exists');
  const previous = JSON.parse(readFileSync('drizzle/meta/' + String(last.idx).padStart(4, '0') + '_snapshot.json', 'utf8'));
  const next = { ...(snapshot || previous), id: randomUUID(), prevId: previous.id };
  writeFileSync(sqlPath, sql, { flag: 'wx' });
  writeFileSync(snapshotPath, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
  journal.entries.push({ idx, version: last.version, when: Math.max(Date.now(), last.when + 1), tag, breakpoints: true });
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n');
  return tag;
}
