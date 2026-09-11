import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const result = await build({
  entryPoints: ['apps/api/seed/world.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { buildSeedWorld } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
const world = buildSeedWorld();
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const players = world.players.filter((p) => p.real);
const statements = players.map((p) => {
  const fields = {
    contact: p.contact,
    power: p.power,
    speed: p.speed,
    fielding: p.field,
    stuff: p.stuff,
    control: p.control,
    potential: p.potential,
  };
  return `UPDATE players SET ${Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(',')},rating_json=${quote(JSON.stringify(p.rating))} WHERE id=${quote(p.id)};`;
});
statements.push(
  "UPDATE catalog_chunks SET version='world-2026-09-11-v13';",
  "UPDATE catalog_meta SET value='world-2026-09-11-v13' WHERE key='version';",
  "DELETE FROM catalog_chunks WHERE section='players';",
);
const initial = readFileSync('apps/api/drizzle/0012_catalog_chunks.sql', 'utf8');
const chunks = initial
  .split('--> statement-breakpoint')
  .find((s) => s.includes("'players', chunk"));
statements.push(chunks.trim());
writeFileSync(
  'apps/api/drizzle/0020_generated_game_abilities.sql',
  '-- Stable fictional estimates replace ungraded abilities; verified performance formulas stay intact.\n' +
    statements.join('\n--> statement-breakpoint\n') +
    '\n',
);
const path = 'apps/api/drizzle/meta/_journal.json';
const journal = JSON.parse(readFileSync(path, 'utf8'));
if (!journal.entries.some((e) => e.idx === 20))
  journal.entries.push({
    idx: 20,
    version: '6',
    when: Date.now(),
    tag: '0020_generated_game_abilities',
    breakpoints: true,
  });
writeFileSync(path, JSON.stringify(journal, null, 2) + '\n');
console.log({
  players: players.length,
  fullyEstimated: players.filter((p) => p.rating.status === 'estimated').length,
  version: world.version,
});
