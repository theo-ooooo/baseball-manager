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
  resolve: { alias: { '@': root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test('forwards progress semantics to the primitive', async () => {
  const { Progress } = await vite.ssrLoadModule('/components/ui/progress.tsx');
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule('/components/ui/chart.tsx');
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: 'contract',
      config: {
        latency: { theme: { light: '#ffffff', dark: '#000000' } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test('renders sidebar skeletons deterministically', async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule('/components/ui/sidebar.tsx');
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test('Dedicated player profile omits hidden potential and shows observed and unmeasured abilities', async () => {
  const { PlayerProfile } = await vite.ssrLoadModule('/apps/web/player-profile.tsx');
  const { WorldProvider } = await vite.ssrLoadModule('/apps/web/world-context.tsx');
  const { buildSeedWorld } = await vite.ssrLoadModule('/apps/api/seed/world.ts');
  const { createGameEngine } = await vite.ssrLoadModule('/apps/api/src/domain/game-engine.ts');
  const { presentState, presentWorld } = await vite.ssrLoadModule(
    '/apps/api/src/services/presentation.ts',
  );
  const world = buildSeedWorld();
  const raw = createGameEngine(world).newGame('kbo-lotte', 'Profile', 'short', 12);
  const render = (game) =>
    renderToStaticMarkup(
      React.createElement(
        WorldProvider,
        { world: presentWorld(world, game.rules.revealPotential) },
        React.createElement(PlayerProfile, {
          player: game.roster.find((p) => p.original === '유강남'),
          game,
          busy: false,
          act: async () => null,
        }),
      ),
    );
  const hidden = render(presentState(raw));
  assert.match(hidden, /유강남/);
  assert.match(hidden, /삼진 회피/);
  assert.match(hidden, /미평가/);
  assert.doesNotMatch(hidden, /잠재력/);
  assert.doesNotMatch(hidden, /role="dialog"/);
  raw.rules.revealPotential = true;
  assert.match(render(presentState(raw)), /잠재력/);
});
