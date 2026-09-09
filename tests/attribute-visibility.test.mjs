import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-visibility-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine'; export * from './apps/api/src/services/presentation'; export * from './packages/shared/src/ratings'; export * from './packages/shared/src/player-attributes';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  world,
  engine: e,
  presentWorld,
  presentState,
  ratingText,
  detailedAttributes,
} = createRequire(import.meta.url)(out);
const game = () => e.newGame('kbo-lotte', '관찰 검증', 'short', 436);
test('Unfamiliar league abilities are removed at every public boundary and reports reveal only estimates', () => {
  let g = game();
  const foreign = e.marketPlayers(g).find((p) => p.club.startsWith('npb-') && !p.real);
  g.transferred.push(structuredClone(foreign));
  const raw = structuredClone(g);
  let publicWorld = presentWorld(world, true, g);
  const hidden = publicWorld.players.find((p) => p.id === foreign.id);
  assert.equal(hidden.contact, 0);
  assert.equal(hidden.potential, 0);
  assert.equal(ratingText(hidden), '?');
  assert.ok(detailedAttributes(hidden).every((a) => a.value === null));
  assert.equal(presentState(g).transferred[0].contact, 0);
  assert.equal(presentState(g).roster[0].contact, g.roster[0].contact);
  g = e.applyAction(g, {
    type: 'assignScout',
    playerId: foreign.id,
    scoutId: g.staff.find((s) => s.role === '스카우트').id,
    days: 7,
  });
  for (let i = 0; i < 7; i++) g = e.applyAction(g, { type: 'advance', count: 1 });
  publicWorld = presentWorld(world, false, g);
  const observed = publicWorld.players.find((p) => p.id === foreign.id);
  assert.equal(observed.contact, 0);
  assert.equal(observed.observation.status, 'scouted');
  assert.ok(observed.observation.overall.length === 2);
  assert.equal(raw.transferred[0].contact, foreign.contact);
  assert.equal(world.players.find((p) => p.id === foreign.id).contact, foreign.contact);
  const second = e.newGame(foreign.club, '타 감독', 'short', 2);
  assert.equal(
    presentWorld(world, false, second).players.find((p) => p.id === foreign.id).observation,
    undefined,
  );
});
