import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { meteredD1 } from '../tests/helpers/d1-meter.mjs';

const baseline = process.argv[2];
if (!baseline || !/^[a-f0-9]{40}$/.test(baseline))
  throw new Error('Pass the full baseline commit SHA');
// Keep temporary bundles under the checkout so external NestJS imports resolve normally.
const directory = await mkdtemp(resolve('work/d1-profile-'));
const require = createRequire(import.meta.url);
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("test"); } }',
  d1Databases: ['DB'],
});
try {
  const database = await mf.getD1Database('DB');
  const journal = JSON.parse(await readFile('apps/api/drizzle/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    const statements = (await readFile(`apps/api/drizzle/${entry.tag}.sql`, 'utf8'))
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < statements.length; i += 25)
      await database.batch(statements.slice(i, i + 25).map((s) => database.prepare(s)));
  }
  const report = {};
  for (const version of ['before', 'after']) {
    const outfile = resolve(directory, `${version}.cjs`);
    await build({
      stdin: {
        contents:
          "export * from './apps/api/src/repositories/career.repository'; export * from './apps/api/src/repositories/catalog.repository'; export {engine,world} from './tests/fixtures/engine';",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile,
      external: ['@nestjs/common'],
      plugins:
        version === 'before'
          ? [
              {
                name: 'baseline',
                setup(build) {
                  build.onLoad({ filter: /(?:career|catalog)\.repository\.ts$/ }, ({ path }) => ({
                    contents: execFileSync(
                      'git',
                      ['show', `${baseline}:${path.slice(process.cwd().length + 1)}`],
                      { encoding: 'utf8' },
                    ),
                    loader: 'ts',
                  }));
                },
              },
            ]
          : [],
    });
    const { CareerRepository, CatalogRepository, engine, world } = require(outfile);
    const meter = meteredD1(database),
      db = meter.db,
      careers = new CareerRepository(),
      catalog = new CatalogRepository();
    report[version] = {};
    await catalog.getWorld(db);
    report[version].catalogCold = meter.total();
    meter.reset();
    await catalog.getWorld(db);
    report[version].catalogWarm = meter.total();
    meter.reset();
    let state = engine.newGame('kbo-lotte', 'D1 profile', 'full', 407),
      revision = 0,
      ledger = [];
    const save = async (action) => {
      const before = revision ? state : null;
      const next = before ? engine.applyAction(before, action) : state;
      meter.reset();
      const result = await careers.save(
        db,
        version,
        revision,
        before,
        next,
        world,
        action.type,
        crypto.randomUUID(),
        ledger,
      );
      report[version][action.type] = meter.total();
      ({ state, revision, ledger } = result);
    };
    await save({ type: 'start' });
    await save({ type: 'readNews', id: state.news[0].id });
    await save({ type: 'tactic', value: 'power' });
    await save({ type: 'continueDay' });
    state.day = -22;
    await save({ type: 'startMatch' });
    await save({
      type: 'reviseMatch',
      cursor: 0,
      timelineVersion: state.liveMatch.timelineVersion,
      lineup: state.lineup,
      pitcher: state.starter,
      instructions: { ...state.instructions, power: 70 },
    });
    await save({
      type: 'completeMatch',
      cursor: state.liveMatch.timeline.log.length,
      timelineVersion: state.liveMatch.timelineVersion,
    });
  }
  console.log(
    JSON.stringify(
      {
        baseline,
        note: 'Local Miniflare D1 row metadata. Save scenarios exclude HTTP/session reads and migrations.',
        ...report,
      },
      null,
      2,
    ),
  );
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
