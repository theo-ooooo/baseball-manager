// Local Node comparison only. This does not measure Cloudflare request CPU limits.
// Run: node scripts/profile-match.mjs [previous-full-commit-sha]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
const baseline = process.argv[2];
if (baseline && !/^[a-f0-9]{40}$/.test(baseline)) throw new Error('Use a full Git commit SHA');
const directory = await mkdtemp(join(tmpdir(), 'dugout-cpu-'));
try {
  for (const commit of [...(baseline ? [baseline] : []), 'working-tree']) {
    const path = join(directory, commit + '.cjs');
    await build({
      stdin: {
        contents:
          "export {world} from './tests/fixtures/engine';export {createGameEngine} from './apps/api/src/domain/game-engine';",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path,
      plugins:
        commit === 'working-tree'
          ? []
          : [
              {
                name: 'baseline',
                setup(builder) {
                  builder.onLoad({ filter: /\.(ts|tsx)$/ }, ({ path }) => {
                    const file = relative(process.cwd(), path);
                    if (
                      !['apps/api/src/', 'packages/shared/src/'].some((prefix) =>
                        file.startsWith(prefix),
                      )
                    )
                      return;
                    return {
                      contents: execFileSync('git', ['show', `${commit}:${file}`], {
                        encoding: 'utf8',
                      }),
                      loader: 'ts',
                    };
                  });
                },
              },
            ],
    });
    const { world, createGameEngine } = createRequire(import.meta.url)(path);
    const start = performance.now();
    for (let i = 0; i < 100; i++) createGameEngine(world);
    const factoryMs = (performance.now() - start) / 100;
    const engine = createGameEngine(world);
    let g = engine.newGame('kbo-lotte', 'CPU QA', 'full', 407);
    g = engine.advance(g, 6);
    let at = performance.now();
    g = engine.applyAction(g, { type: 'startMatch' });
    const prepareMs = performance.now() - at;
    at = performance.now();
    let steps = 0;
    while (!g.liveMatch.finished && steps++ < 1202)
      g = engine.applyAction(g, { type: 'stepMatch' });
    if (!g.liveMatch.finished) throw new Error('Match failed to terminate');
    const compatibilityPlaybackMs = performance.now() - at;
    at = performance.now();
    g = engine.applyAction(g, { type: 'completeMatch' });
    console.log(
      JSON.stringify({
        commit,
        runtime: 'local Node; not Worker CPU',
        factoryMs,
        prepareMs,
        compatibilityPlaybackMs,
        completeMs: performance.now() - at,
        events: g.history[0].log.length,
        score: [g.history[0].awayScore, g.history[0].homeScore],
      }),
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
