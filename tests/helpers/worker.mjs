import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

/** Exercise the actual production entry, Vinext and NestJS together, offline. */
export async function productionWorker(options = {}) {
  const root = resolve('dist/server');
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.json'), 'utf8'));
  const files = await readdir(root, { recursive: true });
  const modules = ['index.js', ...files.filter((f) => f.endsWith('.js') && f !== 'index.js')].map(
    (file) => ({ type: 'ESModule', path: resolve(root, file) }),
  );
  return new Miniflare({
    modules,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    cf: false,
    host: '127.0.0.1',
    d1Databases: ['DB'],
    bindings: { AUTH_PROVIDER: 'sites', ...options.bindings },
    assets: {
      directory: resolve('dist/client'),
      binding: 'ASSETS',
      routerConfig: { has_user_worker: true },
    },
    outboundService:
      options.outboundService ||
      (() => new Response('Tests do not use external services', { status: 503 })),
  });
}
