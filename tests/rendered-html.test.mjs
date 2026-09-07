import assert from 'node:assert/strict';
import test from 'node:test';
import { productionWorker } from './helpers/worker.mjs';

test('Production Worker serves the Korean Vinext page and its assets', async () => {
  const worker = await productionWorker();
  try {
    const response = await worker.dispatchFetch('http://localhost/', { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /<html[^>]*lang="ko"/);
    assert.match(html, /<title>DUGOUT/);
    assert.doesNotMatch(html, /Internal Server Error/);
    const css = html.match(/href="([^"]+\.css)"/);
    assert.ok(css, 'Server rendering references the generated stylesheet');
    const stylesheet = await worker.dispatchFetch(new URL(css[1], 'http://localhost').href);
    assert.equal(stylesheet.status, 200);
    assert.match(await stylesheet.text(), /\.catalog-loading/);
    const favicon = await worker.dispatchFetch('http://localhost/favicon.svg');
    assert.equal(favicon.status, 200);
    assert.match(await favicon.text(), /<svg/);
  } finally {
    await worker.dispose();
  }
}, { timeout: 60000 });
