import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { meteredD1 } from './helpers/d1-meter.mjs';

test('D1 catalog pages preserve career bytes, match canonical rows and fall back on version changes', async () => {
  await mkdir(resolve('work'), { recursive: true });
  const directory = await mkdtemp(resolve('work/catalog-test-'));
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(); } }',
    d1Databases: ['DB'],
  });
  try {
    const outfile = resolve(directory, 'catalog.cjs');
    await build({
      entryPoints: ['apps/api/src/repositories/catalog.repository.ts'],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['@nestjs/common'],
    });
    const { CatalogRepository } = createRequire(import.meta.url)(outfile);
    const database = await mf.getD1Database('DB');
    const journal = JSON.parse(await readFile('apps/api/drizzle/meta/_journal.json', 'utf8'));
    for (const entry of journal.entries) {
      if (entry.idx === 12) {
        await database
          .prepare(
            'INSERT INTO careers(user_id,state,revision,updated_at,write_token) VALUES (?,?,?,?,?)',
          )
          .bind(
            'catalog-migration-sentinel',
            '{"manager":"기존 커리어","opaque":[3,2,1]}',
            27,
            '2026-09-08T00:00:00Z',
            'preserve',
          )
          .run();
      }
      const statements = (await readFile(`apps/api/drizzle/${entry.tag}.sql`, 'utf8'))
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (let i = 0; i < statements.length; i += 25)
        await database.batch(statements.slice(i, i + 25).map((s) => database.prepare(s)));
    }
    const preserved = await database
      .prepare("SELECT * FROM careers WHERE user_id='catalog-migration-sentinel'")
      .first();
    assert.deepEqual(preserved, {
      user_id: 'catalog-migration-sentinel',
      state: '{"manager":"기존 커리어","opaque":[3,2,1]}',
      revision: 27,
      updated_at: '2026-09-08T00:00:00Z',
      write_token: 'preserve',
    });
    const sizes = await database
      .prepare(
        'SELECT COUNT(*) AS pages, MAX(LENGTH(CAST(payload AS BLOB))) AS largest FROM catalog_chunks',
      )
      .first();
    assert.ok(sizes.pages < 80 && sizes.pages > 6);
    assert.ok(sizes.largest < 1000000, 'Each page stays below D1 row size limits');
    const meter = meteredD1(database),
      catalog = new CatalogRepository();
    const packed = await catalog.getWorld(meter.db);
    assert.ok(meter.total().rowsRead < 100, JSON.stringify(meter.total()));
    const lee = packed.players.find((p) => p.original === 'Jung Hoo Lee');
    assert.equal(lee.years, 4);
    assert.equal(lee.catalogContract.throughYear, 2029);
    assert.ok(lee.catalogContract.source.startsWith('https://www.mlb.com/'));
    meter.reset();
    assert.equal(await catalog.getWorld(meter.db), packed);
    assert.ok(meter.total().rowsRead <= 3);
    await database.prepare('DELETE FROM catalog_chunks').run();
    const canonical = await new CatalogRepository().getWorld(database);
    assert.deepEqual(
      packed,
      canonical,
      'Every league, club, player, agent, coach and fixture matches canonical D1 data',
    );
    await database
      .prepare("UPDATE catalog_meta SET value='test-new-version' WHERE key='version'")
      .run();
    await database
      .prepare('UPDATE players SET name=? WHERE id=?')
      .bind('갱신된 선수', packed.players[0].id)
      .run();
    const next = await catalog.getWorld(meter.db);
    assert.equal(next.version, 'test-new-version');
    assert.equal(next.players[0].name, '갱신된 선수');
    assert.equal(packed.players[0].name, canonical.players[0].name);
  } finally {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
