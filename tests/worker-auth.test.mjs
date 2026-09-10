import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { productionWorker } from './helpers/worker.mjs';

async function backupSchema(worker) {
  const db = await worker.getD1Database('DB');
  for (const name of ['0000_regular_redwing', '0001_lonely_zuras', '0013_silly_pyro']) {
    const sql = await readFile(`apps/api/drizzle/${name}.sql`, 'utf8');
    for (const query of sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await db.prepare(query).run();
    }
  }
  return db;
}

test('Guest sessions isolate careers, ignore forged identity, restore possession and reject cross-site changes', async () => {
  const worker = await productionWorker({ bindings: { AUTH_PROVIDER: 'guest' } });
  try {
    const db = await backupSchema(worker);
    const open = () =>
      worker.dispatchFetch('https://localhost/api/session', {
        headers: { 'oai-authenticated-user-id': 'victim', 'x-dugout-user-id': 'victim' },
      });
    const first = await open();
    assert.equal(first.status, 200);
    const cookie = first.headers.get('set-cookie');
    assert.match(cookie, /Secure; HttpOnly; SameSite=Lax/);
    assert.match(cookie, /^__Host-dugout_guest=[a-f0-9]{64}; Path=\//);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const originalKey = (await first.json()).recoveryKey;
    const owner = 'guest:' + createHash('sha256').update(originalKey).digest('hex');
    assert.match(owner, /^guest:[a-f0-9]{64}$/);
    const second = await open();
    assert.notEqual((await second.json()).recoveryKey, originalKey);
    const headers = { cookie: cookie.split(';')[0], 'x-dugout-user-id': 'victim' };
    const state = '{"potential":88.5,"original":"preserved"}';
    await db
      .prepare('INSERT INTO careers(user_id,state,revision,updated_at) VALUES(?,?,?,?)')
      .bind(owner, state, 42, '2026-09-08')
      .run();
    const read = await worker.dispatchFetch('https://localhost/api/career/export', { headers });
    assert.equal(read.status, 401); // Raw backups must not bypass the game's hidden potential presentation.
    const session = await worker.dispatchFetch('https://localhost/api/session', { headers });
    const { recoveryKey } = await session.json();
    const restore = (extra = {}, key = recoveryKey) =>
      worker.dispatchFetch('https://localhost/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...extra },
        body: JSON.stringify({ recoveryKey: key }),
      });
    assert.equal((await restore({ origin: 'https://attacker.example' })).status, 403);
    assert.equal((await restore({ 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await restore({}, 'bad-key')).status, 400);
    assert.equal((await restore({}, 'f'.repeat(64))).status, 404);
    const restored = await restore({ origin: 'https://localhost' });
    assert.equal(restored.status, 200);
    assert.equal(restored.headers.get('set-cookie'), cookie);
    assert.notEqual((await open().then((r) => r.json())).recoveryKey, originalKey);
    const forgedImport = await worker.dispatchFetch('https://localhost/api/career/import', {
      method: 'POST',
      headers: { 'x-dugout-transfer': 'import', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.ok([401, 403, 404].includes(forgedImport.status));
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM careers').first()).n, 1);
  } finally {
    await worker.dispose();
  }
});

test('Temporary Sites transfer credential grants only the owner backup and preserves raw snapshot bytes', async () => {
  const worker = await productionWorker({
    bindings: {
      MIGRATION_EXPORT_TOKEN: 'export-test-credential',
      MIGRATION_OWNER_ID: 'legacy-owner',
      MIGRATION_TRANSFER_EXPIRES: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  try {
    const db = await backupSchema(worker);
    const state = '{"potential":88.5,"contract":{"salary":431,"years":5}}';
    await db
      .prepare('INSERT INTO careers(user_id,state,revision,updated_at) VALUES(?,?,?,?)')
      .bind('legacy-owner', state, 42, '2026-09-08')
      .run();
    await db
      .prepare('INSERT INTO careers(user_id,state,revision,updated_at) VALUES(?,?,?,?)')
      .bind('other-owner', '{}', 2, '2026-09-08')
      .run();
    const headers = { authorization: 'Bearer export-test-credential' };
    const response = await worker.dispatchFetch('http://localhost/api/career/export', { headers });
    assert.equal(response.status, 200);
    const backup = await response.json();
    assert.equal(backup.tables.careers.length, 1);
    assert.equal(backup.tables.careers[0].state, state);
    assert.equal(backup.tables.careers[0].revision, 42);
    assert.equal(
      (await worker.dispatchFetch('http://localhost/api/career', { headers })).status,
      401,
    );
    assert.equal(
      (
        await worker.dispatchFetch('http://localhost/api/career/export', {
          headers: { authorization: 'Bearer wrong' },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await worker.dispatchFetch('http://localhost/api/career', {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'continue' }),
        })
      ).status,
      401,
    );
  } finally {
    await worker.dispose();
  }
});

test('Expiring import endpoint preserves a large snapshot, fixes ownership and refuses overwrites', async () => {
  const source = await productionWorker({
    bindings: {
      MIGRATION_EXPORT_TOKEN: 'source-backup',
      MIGRATION_OWNER_ID: 'original-owner',
      MIGRATION_TRANSFER_EXPIRES: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  const target = await productionWorker({
    bindings: {
      AUTH_PROVIDER: 'guest',
      MIGRATION_IMPORT_TOKEN: 'temporary-transfer',
      MIGRATION_TARGET_ID: 'guest:fixed-owner',
      MIGRATION_TRANSFER_EXPIRES: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  async function fullSchema(worker) {
    const db = await worker.getD1Database('DB');
    const journal = JSON.parse(await readFile('apps/api/drizzle/meta/_journal.json', 'utf8'));
    for (const entry of journal.entries) {
      const sql = await readFile(`apps/api/drizzle/${entry.tag}.sql`, 'utf8');
      for (const query of sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => /^(CREATE|ALTER)\s/i.test(s)))
        await db.prepare(query).run();
    }
    return db;
  }
  try {
    const sourceDb = await fullSchema(source);
    const targetDb = await fullSchema(target);
    const state = JSON.stringify({
      note: '원본 계약과 잠재력',
      potential: 88.5,
      large: 'x'.repeat(600_000),
    });
    await sourceDb
      .prepare('INSERT INTO careers(user_id,state,revision,updated_at) VALUES(?,?,?,?)')
      .bind('original-owner', state, 42, '2026-09-08')
      .run();
    const backup = await source
      .dispatchFetch('https://localhost/api/career/export', {
        headers: { authorization: 'Bearer source-backup' },
      })
      .then((r) => r.json());
    const request = (token = 'temporary-transfer') =>
      target.dispatchFetch('https://localhost/api/career/import', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-dugout-user-id': 'forged-owner',
        },
        body: JSON.stringify(backup),
      });
    assert.equal((await request('wrong-token')).status, 413);
    const imported = await request();
    assert.equal(imported.status, 200, JSON.stringify(await imported.clone().json()));
    assert.equal((await imported.json()).counts.careers, 1);
    assert.equal((await targetDb.prepare('SELECT * FROM careers').first()).state, state);
    assert.equal(
      (await targetDb.prepare('SELECT * FROM careers').first()).user_id,
      'guest:fixed-owner',
    );
    assert.equal((await request()).status, 409);
    assert.equal((await sourceDb.prepare('SELECT * FROM careers').first()).state, state);
  } finally {
    await Promise.all([source.dispose(), target.dispose()]);
  }
});
