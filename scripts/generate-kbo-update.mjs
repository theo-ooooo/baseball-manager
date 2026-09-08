import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'dugout-catalog-'));
try {
  const out = join(dir, 'world.cjs');
  buildSync({
    entryPoints: ['apps/api/seed/world.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: out,
  });
  const world = createRequire(import.meta.url)(out).buildSeedWorld();
  const q = (v) =>
    v == null
      ? 'NULL'
      : typeof v === 'number'
        ? String(v)
        : typeof v === 'boolean'
          ? String(+v)
          : "'" + String(v).replaceAll("'", "''") + "'";
  const sql = ["DELETE FROM players WHERE club_id LIKE 'kbo-%';"];
  const insert = (table, columns, rows) => {
    for (let i = 0; i < rows.length; i += 25)
      sql.push(
        `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES\n${rows
          .slice(i, i + 25)
          .map((r) => '(' + r.map(q).join(',') + ')')
          .join(',\n')};`,
      );
  };
  insert(
    'players',
    [
      'id',
      'club_id',
      'name',
      'original',
      'position',
      'age',
      'is_real',
      'country',
      'number',
      'contact',
      'power',
      'speed',
      'fielding',
      'stuff',
      'control',
      'potential',
      'salary',
      'years',
      'source',
      'sort_order',
      'age_estimated',
    ],
    world.players.flatMap((p, i) =>
      p.club.startsWith('kbo-')
        ? [
            [
              p.id,
              p.club,
              p.name,
              p.original,
              p.pos,
              p.age,
              p.real,
              p.country,
              p.number,
              p.contact,
              p.power,
              p.speed,
              p.field,
              p.stuff,
              p.control,
              p.potential,
              p.salary,
              p.years,
              p.source,
              i,
              p.ageEstimated || false,
            ],
          ]
        : [],
    ),
  );
  insert(
    'coach_candidates',
    [
      'id',
      'name',
      'role',
      'skill',
      'salary',
      'style',
      'sort_order',
      'is_real',
      'source_club',
      'source',
      'verified_role',
    ],
    world.coaches.map((c, i) => [
      c.id,
      c.name,
      c.role,
      c.skill,
      c.salary,
      c.style,
      i,
      !!c.real,
      c.sourceClub,
      c.source,
      c.verifiedRole,
    ]),
  );
  sql.push(`UPDATE catalog_meta SET value=${q(world.version)} WHERE key='version';`);
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
  const entry = journal.entries.find((e) => e.tag.endsWith('_kbo_rosters_and_coaches'));
  if (!entry) throw new Error('Missing custom migration');
  writeFileSync(
    'drizzle/' + entry.tag + '.sql',
    '-- KBO official registration facts as of 2026-09-07. Existing career snapshots are preserved.\n' +
      sql.join('\n--> statement-breakpoint\n') +
      '\n',
  );
  console.log(
    JSON.stringify({
      players: world.players.length,
      realPlayers: world.players.filter((p) => p.real).length,
      realCoaches: world.coaches.filter((c) => c.real).length,
    }),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
