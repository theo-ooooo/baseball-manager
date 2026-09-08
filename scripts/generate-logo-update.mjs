import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { appendMigration } from './append-migration.mjs';
const logos = JSON.parse(readFileSync('apps/api/seed/club-logos.json', 'utf8'));
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const statements = [];
for (const [club, logo] of Object.entries(logos)) {
  if (!/^\/club-logos\/[a-z0-9-]+\.(png|svg|gif|jpe?g|webp)$/.test(logo.path))
    throw new Error('Invalid logo path: ' + club);
  const data = readFileSync('public' + logo.path);
  if (createHash('sha256').update(data).digest('hex') !== logo.sha256)
    throw new Error('Logo hash mismatch: ' + club);
  statements.push(
    `UPDATE clubs SET logo_json=${quote(JSON.stringify(logo))} WHERE id=${quote(club)};`,
  );
}
statements.push("UPDATE catalog_meta SET value='world-2026-09-08-v7' WHERE key='version';");
console.log(
  appendMigration(
    'club_logo_assets',
    '-- Official club marks and provenance; no career data changes.\n' +
      statements.join('\n--> statement-breakpoint\n') +
      '\n',
  ),
);
