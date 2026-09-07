import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

/** Exercise the actual production entry, Vinext and NestJS together, offline. */
export async function productionWorker() {
  const root = resolve('dist/server');
  const files = await readdir(root, { recursive: true });
  const modules = ['index.js', ...files.filter(f => f.endsWith('.js') && f !== 'index.js')]
    .map(file => ({ type: 'ESModule', path: resolve(root, file) }));
  return new Miniflare({
    modules,
    compatibilityDate: '2026-05-22',
    compatibilityFlags: ['nodejs_compat'],
    cf: false,
    host: '127.0.0.1',
    d1Databases: ['DB'],
    assets: { directory: resolve('dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true } },
    outboundService: () => new Response('Tests do not use external services', { status: 503 }),
  });
}
