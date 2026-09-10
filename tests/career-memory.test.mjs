import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['apps/web/src/features/career/career-memory.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { createCareerMemory } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const resources = (revision = 1) => ({
  world: { version: 'v1' },
  career: { state: { club: 'a', knowledge: { leagues: ['kbo'] } }, revision, ledger: [] },
});
test('route memory deduplicates concurrent reads, keeps committed revisions and expires after 30 seconds', async () => {
  let now = 0,
    calls = 0,
    resolve;
  const memory = createCareerMemory(() => now);
  const loader = () => {
    calls++;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const a = memory.load(loader),
    b = memory.load(loader);
  assert.equal(calls, 1);
  resolve(resources());
  assert.deepEqual(await a, await b);
  const committed = resources(2).career;
  memory.career(committed);
  assert.equal((await memory.load(loader)).career.revision, 2);
  now = 30_000;
  const later = memory.load(loader);
  assert.equal(calls, 2);
  resolve(resources(3));
  await later;
  assert.equal((await memory.load(loader)).career.revision, 3);
});
test('visibility changes and explicit resets require fresh data, and old reads cannot overwrite commits', async () => {
  const memory = createCareerMemory();
  let calls = 0;
  const loader = async () => {
    calls++;
    return resources(calls);
  };
  await memory.load(loader);
  memory.career({ ...resources(2).career, state: { club: 'b', knowledge: { leagues: ['npb'] } } });
  await memory.load(loader);
  assert.equal(calls, 2);
  memory.clear();
  let resolve;
  const pending = memory.load(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  memory.career(resources(5).career);
  resolve(resources(1));
  await assert.rejects(pending, /저장 정보가 변경/);
  await memory.load(loader);
  assert.equal(calls, 3);
});
