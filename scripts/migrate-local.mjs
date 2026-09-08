import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'infra/cloudflare/.build');
await mkdir(directory, { recursive: true });
const config = resolve(directory, 'wrangler.local.json');
await writeFile(
  config,
  JSON.stringify(
    {
      name: 'dugout-local',
      compatibility_date: '2026-05-22',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'site-creator-d1',
          // Match the Vite plugin's local placeholder; this command never contacts a remote database.
          database_id: '00000000-0000-4000-8000-000000000000',
          migrations_dir: resolve(root, 'apps/api/drizzle'),
        },
      ],
    },
    null,
    2,
  ),
);
const result = spawnSync(
  resolve(root, 'node_modules/.bin/wrangler'),
  [
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    config,
    '--persist-to',
    resolve(root, 'apps/web/.wrangler/state'),
  ],
  { stdio: 'inherit', env: { ...process.env, CI: 'true' } },
);
if (result.error) throw result.error;
process.exitCode = result.status || 0;
