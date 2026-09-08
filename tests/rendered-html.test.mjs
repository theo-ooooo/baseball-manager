import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { productionWorker } from './helpers/worker.mjs';

test(
  'Production Worker serves the Korean Vinext page and its assets',
  async () => {
    const worker = await productionWorker();
    try {
      const response = await worker.dispatchFetch('http://localhost/', {
        headers: { accept: 'text/html' },
      });
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
      for (const path of [
        '/players/kbo-lotte-real-0?from=squad',
        '/players/missing-player',
        '/?view=tactics',
      ]) {
        const page = await worker.dispatchFetch('http://localhost' + path, {
          headers: { accept: 'text/html' },
        });
        assert.equal(page.status, 200);
        assert.doesNotMatch(await page.text(), /Internal Server Error/);
      }
      const favicon = await worker.dispatchFetch('http://localhost/favicon.svg');
      assert.equal(favicon.status, 200);
      assert.match(await favicon.text(), /<svg/);
      const manifest = JSON.parse(
        await readFile('apps/web/public/club-logos/manifest.json', 'utf8'),
      );
      assert.equal(Object.keys(manifest.logos).length, 134);
      assert.equal(manifest.unavailable.length, 3);
      for (const logo of Object.values(manifest.logos)) {
        const asset = await worker.dispatchFetch('http://localhost' + logo.path);
        assert.equal(asset.status, 200, logo.path);
        assert.equal(asset.headers.get('content-type').split(';')[0], logo.mimeType, logo.path);
        const hash = createHash('sha256')
          .update(Buffer.from(await asset.arrayBuffer()))
          .digest('hex');
        assert.equal(hash, logo.sha256, logo.path);
      }
    } finally {
      await worker.dispose();
    }
  },
  { timeout: 60000 },
);
