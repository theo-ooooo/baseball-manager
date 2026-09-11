import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

// Runs the NestJS Worker bundle (scripts/build-api.mjs output) against a fresh D1 with every
// migration applied, so photo metadata is proven to come from D1 rather than bundled seed data.
let mf;
before(
  async () => {
    mf = new Miniflare({
      modules: [{ type: 'ESModule', path: resolve('apps/api/.build/worker.mjs') }],
      compatibilityDate: '2026-05-22',
      compatibilityFlags: ['nodejs_compat'],
      cf: false,
      host: '127.0.0.1',
      d1Databases: ['DB'],
      bindings: { AUTH_PROVIDER: 'sites' },
      outboundService: () => new Response('Tests do not use external services', { status: 503 }),
    });
    const db = await mf.getD1Database('DB');
    const journal = JSON.parse(await readFile('apps/api/drizzle/meta/_journal.json', 'utf8'));
    for (const entry of journal.entries) {
      const sql = await readFile('apps/api/drizzle/' + entry.tag + '.sql', 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (let i = 0; i < statements.length; i += 25)
        await db.batch(statements.slice(i, i + 25).map((s) => db.prepare(s)));
    }
  },
  { timeout: 120000 },
);
after(async () => {
  if (mf) await mf.dispose();
});

async function call(path, action, user = 'portrait-owner') {
  // The API bundle runs here without the enclosing auth Worker, which normally sets this header.
  const headers = { 'x-dugout-user-id': user };
  if (action !== undefined) headers['content-type'] = 'application/json';
  const response = await mf.dispatchFetch('http://localhost' + path, {
    method: action === undefined ? 'GET' : 'POST',
    headers,
    ...(action === undefined ? {} : { body: JSON.stringify(action) }),
  });
  return { status: response.status, body: await response.json() };
}

test('D1 catalog serves verified KBO photo identities by player id', async () => {
  const seed = JSON.parse(await readFile('apps/api/seed/kbo-portraits-2026-09-10.json', 'utf8'));
  const catalog = await call('/api/catalog');
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body).slice(0, 300));
  assert.equal(catalog.body.version, 'world-2026-09-11-v14');
  const withPortrait = catalog.body.players.filter((p) => p.portrait);
  assert.equal(withPortrait.length, Object.keys(seed.players).length);
  for (const p of withPortrait) {
    assert.deepEqual(p.portrait, seed.players[p.id]);
    assert.ok(p.real && p.club.startsWith('kbo-'));
  }
  const gu = catalog.body.players.find((p) => p.name === '구자욱' && p.club === 'kbo-samsung');
  assert.equal(gu.portrait.officialId, '62404');
  // Same person duplicated in the catalog shares one official id (reported, not guessed).
  const choi = catalog.body.players.filter((p) => p.name === '최형우' && p.club === 'kbo-samsung');
  assert.equal(choi.length, 2);
  assert.equal(new Set(choi.map((p) => p.portrait?.officialId)).size, 1);
});

test('career responses carry roster photos without exposing hidden ratings', async () => {
  const user = 'portrait-career';
  const current = await call('/api/career', undefined, user);
  const started = await call(
    '/api/career',
    {
      type: 'start',
      club: 'kbo-samsung',
      manager: '사진 검증',
      mode: 'short',
      revision: current.body.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(started.status, 201, JSON.stringify(started.body).slice(0, 300));
  const roster = started.body.state.roster;
  const real = roster.filter((p) => p.real);
  const photographed = real.filter((p) => p.portrait);
  assert.ok(photographed.length >= real.length * 0.9, `${photographed.length}/${real.length}`);
  for (const p of photographed) {
    assert.equal(p.portrait.league, 'kbo');
    assert.match(
      p.portrait.url,
      /^https:\/\/6ptotvmi5753\.edge\.naverncp\.com\/KBO_IMAGE\/person\/middle\/2026\/\d+\.jpg$/,
    );
    // Presentation privacy is unchanged: potential stays hidden unless the career reveals it.
    assert.equal(p.potential, 0);
  }
  assert.ok(roster.filter((p) => !p.real).every((p) => !p.portrait));

  // A later GET (the path existing saves take) merges the same photos from the catalog.
  const again = await call('/api/career', undefined, user);
  assert.equal(again.status, 200);
  const againPhotos = again.body.state.roster.filter((p) => p.portrait).length;
  assert.equal(againPhotos, photographed.length);

  // Every photo in the response is exactly the D1 catalog metadata for that player id.
  const catalog = await call('/api/catalog', undefined, user);
  const byId = new Map(catalog.body.players.map((p) => [p.id, p.portrait]));
  for (const p of again.body.state.roster) assert.deepEqual(p.portrait, byId.get(p.id));
});

test('an existing active match gains KBO photos on read without rewriting the saved match or roster', async () => {
  const user = 'portrait-active-match';
  async function act(action) {
    const current = await call('/api/career', undefined, user);
    const result = await call(
      '/api/career',
      {
        ...action,
        revision: current.body.revision,
        requestId: crypto.randomUUID(),
      },
      user,
    );
    assert.equal(result.status, 201, JSON.stringify(result.body).slice(0, 300));
    return result.body;
  }
  await act({ type: 'start', club: 'kbo-samsung', manager: '기존 경기 사진', mode: 'short' });
  for (let i = 0; i < 35; i++) {
    const next = await act({ type: 'continue' });
    for (const news of next.state.news.filter((n) => n.choiceKind && !n.choice))
      await act({ type: 'respondNews', id: news.id, choice: 'explain' });
    if (next.state.progress?.stop === 'fixture') break;
  }
  await act({ type: 'startMatch' });
  const db = await mf.getD1Database('DB');
  const readRow = () =>
    db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first();
  const row = await readRow();
  const state = JSON.parse(row.state);
  assert.ok(state.liveMatch);
  // Reproduce a career saved before photo metadata existed.
  for (const p of state.roster) delete p.portrait;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(state), user)
    .run();
  const before = await readRow();
  const result = await call('/api/career', undefined, user);
  assert.equal(result.status, 200);
  assert.equal(result.body.revision, before.revision);
  const kim = result.body.state.roster.find((p) => p.name === '김지찬');
  assert.equal(kim.portrait.officialId, '50458');
  assert.deepEqual(await readRow(), before, 'GET must not update saved state or revision');
  assert.equal(result.body.state.liveMatch.prepared, undefined);
  assert.equal(result.body.state.liveMatch.opponents, undefined);
  const expectedLive = { ...state.liveMatch };
  delete expectedLive.prepared;
  delete expectedLive.opponents;
  assert.deepEqual(result.body.state.liveMatch, expectedLive);
});

test('D1 nationality migration corrects foreign players and carries national associations through a saved career', async () => {
  const catalog = await call('/api/catalog');
  const reyes = catalog.body.players.find((p) => p.name === '레이예스' && p.club === 'kbo-lotte');
  assert.equal(reyes.country, '베네수엘라');
  assert.equal(reyes.nationalTeam.country, '베네수엘라');
  const ohtani = catalog.body.players.find((p) => p.original === 'Shohei Ohtani');
  assert.equal(ohtani.nationalTeam.country, '일본');
  assert.ok(
    catalog.body.players
      .filter((p) => p.club.startsWith('mlb-'))
      .every((p) => p.country !== '미국 · 캐나다'),
  );
  const user = 'national-career';
  const initial = await call('/api/career', undefined, user);
  const started = await call(
    '/api/career',
    {
      type: 'start',
      club: 'kbo-lotte',
      manager: '국가대표 검증',
      mode: 'full',
      preseason: true,
      revision: initial.body.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(started.status, 201);
  const loaded = await call('/api/career', undefined, user);
  assert.deepEqual(loaded.body.state.international, started.body.state.international);
  assert.equal(
    loaded.body.state.roster.find((p) => p.id === reyes.id).nationalTeam.country,
    '베네수엘라',
  );
});
