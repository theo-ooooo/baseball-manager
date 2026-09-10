import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({
  appType: 'custom',
  configFile: false,
  root,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../apps/web/src', import.meta.url)),
      'next/image': fileURLToPath(new URL('./shims/image.js', import.meta.resolve('vinext'))),
    },
  },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const mlbRecord = {
  name: 'Ryne Nelson',
  league: 'mlb',
  season: 2025,
  kind: 'pitch',
  officialId: '669194',
  source: 'https://statsapi.mlb.com/api/v1/people/669194/stats?stats=yearByYear&group=pitching',
};
const rated = (record) => ({
  version: 'performance-2025-v2',
  status: 'rated',
  season: 2025,
  record,
  method: 'test',
  estimatedAttributes: [],
  base: {},
});
const base = { name: '테스트 선수', number: 18, real: true };

test('derives the MLB headshot only from a verified MLB Stats API person id', async () => {
  const { officialPortrait, officialPortraitUrl, PLAYER_SILHOUETTE } = await vite.ssrLoadModule(
    '/packages/shared/src/player-portrait.ts',
  );
  const mlb = officialPortrait({ ...base, rating: rated(mlbRecord) });
  assert.equal(
    mlb.url,
    'https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/669194/headshot/67/current',
  );
  assert.equal(mlb.sourcePage, 'https://www.mlb.com/player/669194');
  assert.equal(PLAYER_SILHOUETTE, '/images/player-silhouette.svg');
  // KBO and NPB performance records carry no official player id: no photo is guessed by name.
  assert.equal(
    officialPortrait({
      ...base,
      rating: rated({ ...mlbRecord, league: 'kbo', officialId: undefined }),
    }),
    null,
  );
  assert.equal(
    officialPortrait({
      ...base,
      rating: rated({ ...mlbRecord, league: 'npb', officialId: undefined }),
    }),
    null,
  );
  assert.equal(officialPortrait({ ...base, real: false, rating: rated(mlbRecord) }), null);
  assert.equal(
    officialPortrait({ ...base, rating: rated({ ...mlbRecord, officialId: '12a' }) }),
    null,
  );
  assert.equal(officialPortrait({ ...base }), null);
  assert.equal(officialPortraitUrl('mlb', 'abc'), null);
  assert.equal(
    officialPortraitUrl('kbo', '62404'),
    'https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/2026/62404.jpg',
  );
});

test('renders the official photo when verified and the silhouette otherwise', async () => {
  const { PlayerPortrait } = await vite.ssrLoadModule(
    '/apps/web/src/features/players/player-portrait.tsx',
  );
  const withPhoto = renderToStaticMarkup(
    React.createElement(PlayerPortrait, {
      player: { ...base, rating: rated(mlbRecord) },
      size: 'large',
    }),
  );
  assert.match(withPhoto, /img\.mlbstatic\.com\/mlb-photos[^"]*people\/669194\/headshot/);
  assert.match(withPhoto, /data-portrait="mlb"/);
  assert.match(withPhoto, /class="player-portrait large {2}with-photo"/);
  assert.match(withPhoto, /<b class="player-portrait-number">18<\/b>/);

  const fallback = renderToStaticMarkup(
    React.createElement(PlayerPortrait, { player: { ...base, real: false, number: 7 } }),
  );
  assert.match(fallback, /src="\/images\/player-silhouette\.svg"/);
  assert.match(fallback, /data-portrait="default"/);
  assert.match(fallback, /generated silhouette/);
  assert.doesNotMatch(fallback, /mlbstatic/);
});

test('roster name cells and the profile header use the portrait', async () => {
  const { PlayerName } = await vite.ssrLoadModule('/apps/web/src/components/game-ui.tsx');
  const html = renderToStaticMarkup(
    React.createElement(PlayerName, { p: { ...base, pos: 'P', rating: rated(mlbRecord) } }),
  );
  assert.match(html, /class="player-portrait small {2}with-photo"/);
  assert.match(html, /people\/669194\/headshot/);
  assert.doesNotMatch(html, /class="player-avatar/);
});
