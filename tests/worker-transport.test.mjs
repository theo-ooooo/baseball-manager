import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productionWorker } from './helpers/worker.mjs';

test('Worker native Nest transport preserves request bounds, routing, HEAD and exception statuses', async () => {
  const worker = await productionWorker();
  const headers = {
    'oai-authenticated-user-id': 'transport-qa',
    'content-type': 'application/json',
  };
  try {
    const call = (path, init = {}) =>
      worker.dispatchFetch('http://localhost' + path, { headers, ...init });
    const session = await call('/api/session/');
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { mode: 'sites' });
    assert.equal(session.headers.get('cache-control'), 'no-store');
    const head = await call('/api/session', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const path of ['/api/missing', '/api/records/a/b', '/api/career/matches/a/b']) {
      const missing = await call(path);
      assert.equal(missing.status, 404);
      assert.ok((await missing.json()).error);
    }
    assert.equal((await call('/api/career', { method: 'PUT', body: '{}' })).status, 404);
    assert.equal((await call('/api/records/%EA%ZZ')).status, 400);
    assert.equal((await call('/api/career', { method: 'POST', body: '{' })).status, 400);
    assert.equal((await call('/api/career', { method: 'POST', body: '[]' })).status, 400);
    assert.equal(
      (
        await call('/api/career', {
          method: 'POST',
          body: JSON.stringify({ x: '한'.repeat(5000) }),
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await call('/api/career', {
          method: 'POST',
          body: '{}',
          headers: { ...headers, 'content-type': 'text/plain' },
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await call('/api/career', {
          method: 'POST',
          body: '{}',
          headers: { ...headers, origin: 'https://different.example' },
        })
      ).status,
      403,
    );
  } finally {
    await worker.dispose();
  }
});
