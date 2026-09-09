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
      // Use the same image implementation as the production Vinext plugin.
      'next/image': fileURLToPath(new URL('./shims/image.js', import.meta.resolve('vinext'))),
    },
  },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test('forwards progress semantics to the primitive', async () => {
  const { Progress } = await vite.ssrLoadModule('/apps/web/src/components/ui/progress.tsx');
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test('renders sidebar skeletons deterministically', async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    '/apps/web/src/components/ui/sidebar.tsx',
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test('Dedicated player profile omits hidden potential and shows observed and unmeasured abilities', async () => {
  const { PlayerProfile } = await vite.ssrLoadModule(
    '/apps/web/src/features/players/player-profile.tsx',
  );
  const { WorldProvider } = await vite.ssrLoadModule(
    '/apps/web/src/features/career/world-context.tsx',
  );
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

test('Club badges render sourced assets and a labelled abbreviation when no logo is available', async () => {
  const { ClubBadge } = await vite.ssrLoadModule('/apps/web/src/components/club-badge.tsx');
  const { buildSeedWorld } = await vite.ssrLoadModule('/apps/api/seed/world.ts');
  const world = buildSeedWorld();
  const sourced = world.clubs.find((club) => club.id === 'kbo-lotte');
  const html = renderToStaticMarkup(React.createElement(ClubBadge, { club: sourced }));
  assert.ok(html.includes(`src="${sourced.logo.path}"`));
  assert.ok(html.includes(`alt="${sourced.name} 로고"`));
  const missing = world.clubs.find((club) => club.id === 'lmp-tucson');
  const fallback = renderToStaticMarkup(React.createElement(ClubBadge, { club: missing }));
  assert.ok(fallback.includes(`aria-label="${missing.name} 구단 약칭"`));
  assert.doesNotMatch(fallback, /<img/);
});

test('Growth arrows show observed fractional changes without exposing unknown attributes or inventing a baseline', async () => {
  const { PlayerAttributes, PlayerGrowth, GrowthChange } = await vite.ssrLoadModule(
    '/apps/web/src/features/players/growth-indicator.tsx',
  );
  const { buildSeedWorld } = await vite.ssrLoadModule('/apps/api/seed/world.ts');
  const { abilityAverage, abilityKeys } = await vite.ssrLoadModule(
    '/packages/shared/src/development.ts',
  );
  const world = buildSeedWorld();
  const p = structuredClone(world.players.find((p) => p.name === '유강남'));
  const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
  assert.equal(render(PlayerGrowth, { player: p }), '');
  p.development = {
    history: [
      {
        date: '2026-03-01',
        overall: abilityAverage(p),
        abilities: Object.fromEntries(abilityKeys.map((k) => [k, p[k]])),
      },
    ],
  };
  p.contact += 0.24;
  p.power -= 0.15;
  p.field += 5;
  const before = structuredClone(p);
  const html = render(PlayerAttributes, { player: p, owned: true });
  assert.match(html, /컨택 상승 0.24 · 2026-03-01 관찰 대비/);
  assert.match(html, /파워 하락 0.15/);
  assert.doesNotMatch(html, /수비 상승|잠재력/);
  assert.match(html, /미평가/);
  assert.doesNotMatch(render(PlayerAttributes, { player: p, owned: false }), /growth-delta/);
  assert.deepEqual(p, before);
  for (const delta of [null, 0, 0.004, -0.004, NaN])
    assert.equal(render(GrowthChange, { delta }), '');
  assert.match(render(GrowthChange, { delta: 0.005 }), /\+0.01/);
  assert.match(render(GrowthChange, { delta: -0.005 }), /-0.01/);
  p.rating.status = 'missing';
  assert.equal(render(PlayerGrowth, { player: p }), '');
  assert.doesNotMatch(render(PlayerAttributes, { player: p, owned: true }), /growth-delta/);
});
