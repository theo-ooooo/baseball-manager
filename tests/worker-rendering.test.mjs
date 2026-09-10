import assert from 'node:assert/strict';
import test from 'node:test';
import { productionWorker } from './helpers/worker.mjs';

test(
  'Cold production HTML routes render a session-neutral loading screen with working build assets',
  async () => {
    const mf = await productionWorker({ bindings: { AUTH_PROVIDER: 'guest' } });
    try {
      for (const path of [
        '/?view=tactics',
        '/match',
        '/players/real-2149789910?from=squad',
        '/interviews/qa-interview',
        '/manager/offers',
      ]) {
        const response = await mf.dispatchFetch('https://game.test' + path);
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /text\/html/);
        const html = await response.text();
        assert.match(html, /커리어 불러오는 중/);
        assert.ok(!html.includes('AUTH_PROVIDER'));
        if (path === '/?view=tactics') {
          assert.match(html, /initialView/);
          assert.match(html, /tactics/);
          const assets = [
            ...new Set(
              [...html.matchAll(/(?:src|href)="(\/assets\/[^"<>]+\.(?:js|css))"/g)].map(
                (m) => m[1],
              ),
            ),
          ];
          assert.ok(assets.some((p) => p.endsWith('.js')));
          assert.ok(assets.some((p) => p.endsWith('.css')));
          for (const asset of assets)
            assert.equal((await mf.dispatchFetch('https://game.test' + asset)).status, 200, asset);
        }
      }
    } finally {
      await mf.dispose();
    }
  },
  { timeout: 30000 },
);
