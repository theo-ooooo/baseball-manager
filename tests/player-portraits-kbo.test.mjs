import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({
  appType: 'custom',
  configFile: false,
  root,
  server: { middlewareMode: true },
});
after(async () => {
  await vite.close();
});

const seed = JSON.parse(
  await readFile(
    new URL('../apps/api/seed/kbo-portraits-2026-09-10.json', import.meta.url),
    'utf8',
  ),
);
const migration = await readFile(
  new URL('../apps/api/drizzle/0015_kbo_player_portraits.sql', import.meta.url),
  'utf8',
);

test('KBO portrait seed carries only verified official ids with evidence and no name guessing', () => {
  const entries = Object.entries(seed.players);
  assert.ok(entries.length >= 300, `expected a substantial verified set, got ${entries.length}`);
  for (const [id, portrait] of entries) {
    assert.match(id, /^real-\d+/);
    assert.equal(portrait.league, 'kbo');
    assert.match(portrait.officialId, /^\d+$/);
    assert.equal(
      portrait.url,
      `https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/2026/${portrait.officialId}.jpg`,
    );
    assert.match(portrait.source, /^https:\/\/www\.koreabaseball\.com\/.*playerId=\d+$/);
    const evidence = seed.evidence[id];
    assert.ok(evidence, `missing evidence for ${id}`);
    assert.match(evidence.club, /^kbo-/);
    // Every match is anchored on the official club listing: same club and same name at minimum.
    assert.match(evidence.basis, /^club\+name/);
    if (evidence.basis === 'club+name+number')
      assert.equal(evidence.catalogNumber, evidence.officialNumber);
  }
  // Skipped players stay documented instead of being guessed.
  assert.ok(Array.isArray(seed.skipped) && seed.skipped.length > 0);
});

test('portrait migrations preserve verified identities and append Son Seong-bin', async () => {
  const value = migration.match(/VALUES\('player_portraits','([\s\S]*?)'\) ON CONFLICT/)[1];
  const stored = JSON.parse(value.replaceAll("''", "'"));
  const { 'real-2149789910': son, ...original } = seed.players;
  assert.deepEqual(stored, original);
  assert.equal(son.officialId, '51528');
  const addition = await readFile(
    new URL('../apps/api/drizzle/0016_lotte_son_seongbin.sql', import.meta.url),
    'utf8',
  );
  assert.ok(addition.includes(JSON.stringify(son)) || addition.includes(son.url));
  assert.match(migration, /UPDATE catalog_chunks SET version='world-2026-09-10-v9'/);
  assert.match(
    migration,
    /UPDATE catalog_meta SET value='world-2026-09-10-v9' WHERE key='version'/,
  );
  assert.doesNotMatch(migration, /career_players|contracts|UPDATE players/);
});

test('seed world attaches portraits by id and the resolver prefers them over MLB records', async () => {
  const { buildSeedWorld } = await vite.ssrLoadModule('/apps/api/seed/world.ts');
  const { officialPortrait } = await vite.ssrLoadModule('/packages/shared/src/player-portrait.ts');
  const world = buildSeedWorld();
  assert.equal(world.version, 'world-2026-09-14-v16');
  const withPortrait = world.players.filter((p) => p.portrait);
  assert.equal(withPortrait.length, Object.keys(seed.players).length);
  for (const p of withPortrait) {
    assert.ok(p.real);
    assert.ok(p.club.startsWith('kbo-'));
    const resolved = officialPortrait(p);
    assert.equal(resolved.url, p.portrait.url);
    assert.equal(resolved.league, 'kbo');
  }
  // One well-known verified example: 구자욱 (삼성 #5) → KBO playerId 62404.
  const gu = world.players.find((p) => p.name === '구자욱' && p.club === 'kbo-samsung');
  assert.equal(gu.portrait.officialId, '62404');
  // Players without metadata still resolve through the MLB record path or to nothing.
  const kboWithout = world.players.find((p) => p.real && p.club.startsWith('kbo-') && !p.portrait);
  assert.equal(officialPortrait(kboWithout), null);
});

test('attachPortraits merges photos into saved rosters and deals without touching other fields', async () => {
  const { attachPortraits, presentCareer } = await vite.ssrLoadModule(
    '/apps/api/src/services/presentation.ts',
  );
  const portrait = {
    league: 'kbo',
    officialId: '62404',
    url: 'https://x/62404.jpg',
    source: 'https://x',
    asOf: '2026-09-10',
  };
  const world = { players: [{ id: 'real-1', portrait }, { id: 'real-2' }] };
  const stored = {
    id: 'real-1',
    name: '구자욱',
    club: 'kbo-lg',
    real: true,
    potential: 77,
    contact: 80,
    salary: 10,
    stats: {},
  };
  const other = {
    id: 'real-2',
    name: '기타',
    club: 'kbo-lg',
    real: true,
    potential: 60,
    contact: 50,
    salary: 5,
    stats: {},
  };
  const career = {
    revision: 3,
    state: {
      club: 'kbo-lg',
      rules: {},
      roster: [stored, other],
      transferred: [{ ...stored, club: 'kbo-samsung' }],
      deals: [{ id: 'd1', player: { ...stored } }],
      history: [],
      knowledge: { players: [], clubs: ['kbo-lg'], leagues: ['kbo'] },
      ownership: {},
    },
  };
  const merged = attachPortraits(career, world);
  assert.notEqual(merged, career);
  assert.equal(merged.revision, 3);
  // The photo follows the player id even after a move to another club.
  assert.deepEqual(merged.state.roster[0].portrait, portrait);
  assert.deepEqual(merged.state.transferred[0].portrait, portrait);
  assert.deepEqual(merged.state.deals[0].player.portrait, portrait);
  assert.equal(merged.state.roster[1].portrait, undefined);
  // Stored save objects are not mutated and nothing else changes.
  assert.equal(stored.portrait, undefined);
  assert.equal(merged.state.roster[0].contact, 80);
  assert.equal(merged.state.roster[0].salary, 10);
  // Presentation privacy still applies after the merge: potential hidden without reveal.
  const presented = presentCareer(merged);
  assert.equal(presented.state.roster[0].potential, 0);
  assert.deepEqual(presented.state.roster[0].portrait, portrait);
  // Idempotent and cheap when the world has no portraits.
  assert.equal(attachPortraits(career, { players: [{ id: 'real-1' }] }), career);
  assert.equal(attachPortraits({ state: null }, world).state, null);
});
