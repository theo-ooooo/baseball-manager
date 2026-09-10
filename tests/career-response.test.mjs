import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['apps/web/src/features/career/career-response.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { mergeCareerResponse, careerResponse } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
test('conversation response only merges server-owned fields at the matching revision', () => {
  const before = {
    state: {
      managerCareer: { status: 'unemployed' },
      news: [],
      roster: [{ id: 'one' }],
      budget: 31,
    },
    revision: 12,
    ledger: [{ balance: 31 }],
  };
  const patch = {
    baseRevision: 12,
    revision: 13,
    patch: {
      managerCareer: { status: 'unemployed', offers: [{ status: 'interview' }] },
      news: [{ id: 'invitation' }],
      budget: 999,
    },
  };
  const result = mergeCareerResponse(before, patch);
  assert.equal(result.state.budget, 31);
  assert.equal(result.state.roster, before.state.roster);
  assert.equal(result.ledger, before.ledger);
  assert.equal(before.revision, 12);
  assert.equal(result.revision, 13);
  assert.equal(result.state.managerCareer.offers[0].status, 'interview');
  assert.throws(() => mergeCareerResponse(result, patch));
  assert.throws(() => mergeCareerResponse(before, { ...patch, revision: 15 }));
  assert.throws(() => mergeCareerResponse({ ...before, state: null }, patch));
  const full = { ...before, revision: 14 };
  assert.equal(mergeCareerResponse(result, full), full);
});
test('Cloudflare HTML failure is reported as a recoverable service error', async () => {
  await assert.rejects(
    careerResponse(
      new Response('<html>Error 1102</html>', {
        status: 500,
        headers: { 'content-type': 'text/html' },
      }),
    ),
    /서버 처리가 중단/,
  );
  assert.deepEqual(await careerResponse(Response.json({ revision: 2 })), { revision: 2 });
});
