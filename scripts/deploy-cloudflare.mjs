import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = JSON.parse(await readFile(resolve(root, 'infra/cloudflare/wrangler.jsonc'), 'utf8'));
const compiled = JSON.parse(await readFile(resolve(root, 'dist/server/wrangler.json'), 'utf8'));
const dryRun = process.argv.includes('--dry-run');
if (
  compiled.compatibility_date !== source.compatibility_date ||
  JSON.stringify(compiled.compatibility_flags) !== JSON.stringify(source.compatibility_flags)
)
  throw new Error(
    'Deploy the same compatibility settings exercised by the production Worker tests.',
  );
if (source.vars.AUTH_PROVIDER !== 'guest')
  throw new Error('Public deployment requires isolated guest sessions.');

const config = {
  ...compiled,
  name: source.name,
  account_id: source.account_id,
  main: resolve(root, 'dist/server/index.js'),
  compatibility_date: source.compatibility_date,
  compatibility_flags: source.compatibility_flags,
  vars: source.vars,
  workers_dev: source.workers_dev,
  preview_urls: false,
  observability: source.observability,
  assets: { ...compiled.assets, binding: 'ASSETS', directory: resolve(root, 'dist/client') },
  images: source.images,
  d1_databases: source.d1_databases.map((db) => ({
    ...db,
    migrations_dir: resolve(root, 'infra/cloudflare', db.migrations_dir),
  })),
};
const directory = resolve(root, 'dist/cloudflare');
await mkdir(directory, { recursive: true });
const path = resolve(directory, 'wrangler.json');
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
const wrangler = resolve(root, 'node_modules/.bin/wrangler');
function run(args) {
  const result = spawnSync(wrangler, [...args, '--config', path], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_LOG_PATH: resolve(root, '.wrangler/deploy.log') },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!dryRun) {
  // Cloudflare's pre-migration bookmark supports restoring the existing database.
  run(['d1', 'time-travel', 'info', 'DB', '--json']);
  run(['d1', 'migrations', 'apply', 'DB', '--remote']);
}
run(['deploy', ...(dryRun ? ['--dry-run'] : [])]);
if (!dryRun) {
  run([
    'd1',
    'execute',
    'DB',
    '--remote',
    '--command',
    "SELECT value FROM catalog_meta WHERE key='version'; SELECT COUNT(*) AS careers FROM careers;",
    '--json',
  ]);
  const response = await fetch('https://baseball-manager.kkwondev.workers.dev/api/health');
  const health = await response.json();
  if (!response.ok || health.status !== 'ok' || health.database !== 'cloudflare-d1')
    throw new Error('Deployed API health check failed.');
  console.log('Production health check passed:', health.catalogVersion);
}
