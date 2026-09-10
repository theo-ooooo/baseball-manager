import { build, context } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(path.join(root, 'apps/api/.build'), { recursive: true });
// Nest's optional websocket/microservice loaders must fail only if invoked.
const optional = {
  name: 'nest-optional-integrations',
  setup(b) {
    b.onResolve(
      {
        filter: /^(@nestjs\/(websockets|microservices)(\/|$)|class-validator$|class-transformer$)/,
      },
      (a) => ({ path: a.path, namespace: 'optional' }),
    );
    b.onLoad({ filter: /.*/, namespace: 'optional' }, () => ({
      contents: 'throw new Error("This optional NestJS integration is not installed");',
      loader: 'js',
    }));
  },
};
const options = {
  absWorkingDir: root,
  entryPoints: ['apps/api/src/worker.ts'],
  outfile: 'apps/api/.build/worker.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  minify: true,
  external: ['cloudflare:*', 'node:*'],
  plugins: [optional],
  banner: {
    js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url || '/worker.js');",
  },
};
if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
  console.log('NestJS Worker source watcher ready.');
} else {
  await build(options);
  console.log('NestJS Worker bundle built.');
}
