import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { productionWorker } from './helpers/worker.mjs';

let mf, db;
before(
  async () => {
    mf = await productionWorker();
    db = await mf.getD1Database('DB');
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
  { timeout: 60000 },
);
after(async () => {
  if (mf) await mf.dispose();
});
async function call(path = '/api/career', action, user = 'test-owner-a', extra = {}) {
  const headers = { ...(user ? { 'oai-authenticated-user-id': user } : {}), ...extra };
  if (action !== undefined) headers['content-type'] = 'application/json';
  const response = await mf.dispatchFetch('http://localhost' + path, {
    method: action === undefined ? 'GET' : 'POST',
    headers,
    ...(action === undefined ? {} : { body: JSON.stringify(action) }),
  });
  return { status: response.status, body: await response.json() };
}
async function action(payload, user = 'test-owner-a') {
  const current = await call('/api/career', undefined, user);
  const result = await call(
    '/api/career',
    { ...payload, revision: current.body.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result));
  return result.body;
}

test('D1 commits a full-roster exchange once and rejected exchanges leave both players unchanged', async () => {
  const user = 'roster-exchange';
  const before = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Exchange', mode: 'short' },
    user,
  );
  const incoming = before.state.roster.find((p) => p.squad === 'reserve' && p.pos === 'P');
  const outgoing = before.state.starter;
  const command = {
    type: 'squad',
    id: incoming.id,
    value: 'first',
    replaceId: outgoing,
    revision: before.revision,
    requestId: crypto.randomUUID(),
  };
  const changed = await call('/api/career', command, user);
  assert.equal(changed.status, 201);
  assert.equal(changed.body.revision, before.revision + 1);
  assert.equal(changed.body.state.starter, incoming.id);
  assert.equal(changed.body.state.roster.filter((p) => p.squad !== 'reserve').length, 28);
  const reloaded = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(reloaded.state, changed.body.state);
  for (const [id, squad] of [
    [incoming.id, 'first'],
    [outgoing, 'reserve'],
  ]) {
    const row = await db
      .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
      .bind(user, id)
      .first();
    assert.equal(JSON.parse(row.data).squad, squad);
  }
  const repeated = await call('/api/career', command, user);
  assert.equal(repeated.body.revision, reloaded.revision);
  const rejected = await call(
    '/api/career',
    {
      type: 'squad',
      id: outgoing,
      value: 'first',
      replaceId: 'not-our-player',
      revision: reloaded.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(rejected.status, 400);
  const after = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(after, reloaded);
  assert.deepEqual(after.state.history, before.state.history);
  assert.equal(after.state.budget, before.state.budget);
  for (const p of after.state.roster) {
    const old = before.state.roster.find((v) => v.id === p.id);
    assert.deepEqual(p.stats, old.stats);
    assert.equal(p.salary, old.salary);
    assert.equal(p.years, old.years);
  }
});

test('Workers runs NestJS with migrated D1 catalog and protects career identity', async () => {
  const health = await call('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.backend, 'nestjs');
  assert.equal((await call('/api/career', undefined, null)).status, 401);
  const catalog = await call('/api/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.leagues.length, 13);
  assert.equal(catalog.body.clubs.length, 137);
  const logos = JSON.parse(await readFile('apps/api/seed/club-logos.json', 'utf8'));
  for (const club of catalog.body.clubs) {
    assert.deepEqual(club.logo, logos[club.id]);
  }
  assert.equal(catalog.body.players.length, 4503);
  assert.equal(catalog.body.players.filter((p) => p.real).length, 2042);
  assert.equal(new Set(catalog.body.players.map((p) => p.id)).size, 4503);
  const g = await action({ type: 'start', club: 'kbo-lg', manager: 'DB Test', mode: 'short' });
  assert.equal(g.revision, 1);
  assert.equal(g.state.staff.length, 5);
  const rows = await db
    .prepare('SELECT COUNT(*) AS n FROM career_players WHERE user_id=?')
    .bind('test-owner-a')
    .first();
  assert.equal(rows.n, g.state.roster.length);
  assert.equal((await call('/api/career', undefined, 'test-owner-b')).body.state, null);
  const denied = await call(
    '/api/career',
    { type: 'tactic', value: 'power', revision: 1 },
    'test-owner-a',
    { origin: 'https://unrelated.example' },
  );
  assert.equal(denied.status, 403);
  assert.equal((await call()).body.revision, 1);
});

test('Daily calendar progression persists one date and a retried request cannot advance twice', async () => {
  const user = 'calendar-progress';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Calendar', mode: 'short' },
    user,
  );
  const command = {
    type: 'continueDay',
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const saved = await call('/api/career', command, user);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.state.day, -27);
  assert.equal(saved.body.state.progress.to, -27);
  assert.equal(saved.body.revision, initial.revision + 1);
  const repeated = await call('/api/career', command, user);
  assert.equal(repeated.body.revision, saved.body.revision);
  assert.equal(repeated.body.state.day, -27);
  const stale = await call('/api/career', { ...command, requestId: crypto.randomUUID() }, user);
  assert.equal(stale.status, 409);
  const loaded = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(loaded.state, saved.body.state);
});

test('Negotiation, signing, reselling and coaches update relational rows and accounting atomically', async () => {
  const catalog = (await call('/api/catalog')).body;
  const p = catalog.players.find((p) => p.club === 'fa');
  const negotiated = await action({ type: 'negotiate', id: p.id, salary: p.salary * 2, years: 3 });
  assert.notEqual(negotiated.state.deals[0].status, 'rejected');
  const deal = negotiated.state.deals[0],
    requestId = crypto.randomUUID();
  const command = { type: 'sign', id: deal.id, revision: negotiated.revision, requestId };
  const results = await Promise.all([
    call('/api/career', command),
    call('/api/career', { ...command, requestId: crypto.randomUUID() }),
  ]);
  assert.equal(results.filter((r) => r.status < 300).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const saved = (await call()).body;
  assert.equal(saved.state.roster.filter((x) => x.id === p.id).length, 1);
  const contract = await db
    .prepare('SELECT salary,years FROM contracts WHERE user_id=? AND player_id=?')
    .bind('test-owner-a', p.id)
    .first();
  assert.equal(contract.salary, deal.salary);
  assert.equal(contract.years, 3);
  const currentBalance = saved.state.budget;
  // Repeating a successfully recorded request cannot charge the account twice.
  const winning = results.find((r) => r.status < 300).body;
  const recorded = await db
    .prepare('SELECT request_id FROM career_actions WHERE user_id=? AND revision=?')
    .bind('test-owner-a', winning.revision)
    .first();
  const replayed = await call('/api/career', { ...command, requestId: recorded.request_id });
  assert.equal(replayed.body.state.budget, currentBalance);
  await action({ type: 'listPlayer', id: p.id });
  const marketUpdate = await action({ type: 'advance', count: 3 });
  const buyer = marketUpdate.state.saleOffers.find((o) => o.playerId === p.id);
  assert.ok(buyer);
  await action({ type: 'sell', id: p.id, offerId: buyer.id });
  const sold = await db
    .prepare('SELECT club_id FROM career_players WHERE user_id=? AND player_id=?')
    .bind('test-owner-a', p.id)
    .first();
  assert.notEqual(sold.club_id, 'kbo-lg');
  const transfers = await db
    .prepare('SELECT kind FROM transfers WHERE user_id=? AND player_id=? ORDER BY revision')
    .bind('test-owner-a', p.id)
    .all();
  assert.deepEqual(
    transfers.results.map((r) => r.kind),
    ['signing', 'sale'],
  );
  const coach = catalog.coaches.find((c) => c.role === '투수' && c.skill > 85);
  const coached = await action({ type: 'coach', id: coach.id });
  const staff = await db
    .prepare('SELECT coach_id FROM career_staff WHERE user_id=? AND role=?')
    .bind('test-owner-a', '투수')
    .first();
  assert.equal(staff.coach_id, coach.id);
  const balance = await db
    .prepare('SELECT SUM(amount) AS total FROM finance_entries WHERE user_id=?')
    .bind('test-owner-a')
    .first();
  assert.ok(Math.abs(balance.total - coached.state.budget) < 1e-7);
  const revision = coached.revision;
  const rejected = await call('/api/career', { type: 'lineup', ids: [], revision });
  assert.equal(rejected.status, 400);
  assert.equal((await call()).body.revision, revision);
});

test(
  'Complete season persists standings, archived replays and the following season',
  async () => {
    let saved = (await call()).body,
      count = 0;
    while (saved.state.phase !== 'finished' && count++ < 20)
      saved = await action({ type: 'advance', count: 7 });
    assert.equal(saved.state.phase, 'finished');
    assert.ok(saved.state.champion);
    const rows = await db
      .prepare(
        'SELECT SUM(wins) AS w,SUM(losses) AS l,SUM(runs_for) AS rf,SUM(runs_against) AS ra FROM career_standings WHERE user_id=?',
      )
      .bind('test-owner-a')
      .first();
    assert.equal(rows.w, rows.l);
    assert.equal(rows.rf, rows.ra);
    const archived = saved.state.history.at(-1);
    assert.equal(archived.log.length, 0);
    const replay = await call('/api/career/matches/' + encodeURIComponent(archived.id));
    assert.equal(replay.status, 200);
    assert.ok(replay.body.log.length > 0);
    const other = await call(
      '/api/career/matches/' + encodeURIComponent(archived.id),
      undefined,
      'test-owner-b',
    );
    assert.equal(other.status, 404);
    saved = await action({ type: 'nextSeason' });
    assert.equal(saved.state.year, 2027);
    assert.equal(saved.state.history.length, 0);
    assert.equal(
      (await call('/api/career/matches/' + encodeURIComponent(archived.id))).status,
      200,
    );
    const contracts = await db
      .prepare('SELECT COUNT(*) AS n FROM contracts WHERE user_id=? AND club_id=?')
      .bind('test-owner-a', saved.state.club)
      .first();
    assert.equal(contracts.n, saved.state.roster.length);
  },
  { timeout: 60000 },
);

test('D1 persists defensive swaps, tactic books, reserve development and real coach metadata', async () => {
  const user = 'management-test';
  let saved = await action(
    {
      type: 'start',
      club: 'kbo-lotte',
      manager: 'Management',
      mode: 'short',
      firstSeasonTransferBan: true,
    },
    user,
  );
  assert.equal(saved.state.phase, 'preseason');
  assert.equal(saved.state.day, -28);
  assert.ok(saved.state.roster.some((p) => p.name === '전민재' && p.real));
  const d = saved.state.defense;
  const a = d.LF,
    b = d.SS;
  saved = await action({ type: 'defense', id: a, position: 'SS' }, user);
  assert.equal(saved.state.defense.LF, b);
  saved = await action({ type: 'saveTactic', name: '수비 교체' }, user);
  const id = saved.state.tacticBook[0].id;
  saved = await action({ type: 'tactic', value: 'power' }, user);
  saved = await action({ type: 'loadTactic', id }, user);
  assert.equal(saved.state.defense.SS, a);
  const reserve = saved.state.roster.find((p) => p.squad === 'reserve' && p.pos === 'IF');
  saved = await action({ type: 'positionTraining', id: reserve.id, position: 'SS' }, user);
  saved = await action({ type: 'advance', count: 7 }, user);
  const reloaded = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(reloaded.state.reserve, saved.state.reserve);
  assert.ok(reloaded.state.reserve.history.length > 0);
  const projected = await db
    .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
    .bind(user, reserve.id)
    .first();
  assert.ok(JSON.parse(projected.data).familiarity.SS > 0);
  const trained = JSON.parse(projected.data);
  saved = await action({ type: 'positionTraining', id: reserve.id, position: '' }, user);
  const reset = (await call('/api/career', undefined, user)).body.state.roster.find(
    (p) => p.id === reserve.id,
  );
  assert.equal(reset.positionTraining, undefined);
  assert.deepEqual(reset.familiarity, trained.familiarity);
  assert.deepEqual(reset.stats, trained.stats);
  const storedReset = await db
    .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
    .bind(user, reserve.id)
    .first();
  assert.equal(JSON.parse(storedReset.data).positionTraining, undefined);
  const staff = await db
    .prepare('SELECT is_real,source_club FROM career_staff WHERE user_id=?')
    .bind(user)
    .all();
  assert.ok(staff.results.every((c) => c.is_real === 1 && c.source_club === 'kbo-lotte'));
  const p = (await call('/api/catalog')).body.players.find((p) => p.club === 'fa');
  const rejected = await call(
    '/api/career',
    { type: 'negotiate', id: p.id, salary: p.salary * 2, years: 3, revision: saved.revision },
    user,
  );
  assert.equal(rejected.status, 400);
  assert.equal((await call('/api/career', undefined, user)).body.revision, saved.revision);
});

test('Changing a catalog row and revision changes API data without changing source files', async () => {
  await db.batch([
    db.prepare('UPDATE clubs SET name=? WHERE id=?').bind('DB 원본 확인', 'kbo-lg'),
    db.prepare("UPDATE catalog_meta SET value='test-revision' WHERE key='version'"),
  ]);
  const world = (await call('/api/catalog')).body;
  assert.equal(world.clubs.find((c) => c.id === 'kbo-lg').name, 'DB 원본 확인');
  assert.equal(world.version, 'test-revision');
});

test(
  'Live D1 saves resume, deduplicate concurrent steps and defer all projection/accounting writes until completion',
  async () => {
    const user = 'live-d1';
    let saved = await action(
      { type: 'start', club: 'kbo-lotte', manager: 'Live DB', mode: 'short' },
      user,
    );
    saved = await action({ type: 'continue' }, user);
    saved = await action({ type: 'startMatch' }, user);
    assert.equal(saved.state.liveMatch.result.log.length, 0);
    assert.equal(saved.state.liveMatch.opponents, undefined);
    const baseline = {
      budget: saved.state.budget,
      day: saved.state.day,
      history: saved.state.history,
      standings: saved.state.standings,
    };
    await db.batch([
      db.prepare('CREATE TABLE projection_probe (event TEXT)'),
      db.prepare(
        "CREATE TRIGGER observe_player_projection AFTER INSERT ON career_players BEGIN INSERT INTO projection_probe VALUES('player'); END",
      ),
      db.prepare(
        "CREATE TRIGGER observe_contract_projection AFTER DELETE ON contracts BEGIN INSERT INTO projection_probe VALUES('contract'); END",
      ),
    ]);
    const requestId = crypto.randomUUID(),
      command = { type: 'stepMatch', revision: saved.revision, requestId };
    const race = await Promise.all([
      call('/api/career', command, user),
      call('/api/career', { ...command, requestId: crypto.randomUUID() }, user),
    ]);
    assert.equal(race.filter((r) => r.status < 300).length, 1);
    assert.equal(race.filter((r) => r.status === 409).length, 1);
    saved = (await call('/api/career', undefined, user)).body;
    assert.equal(saved.state.liveMatch.cursor, 1);
    const winningId = (
      await db
        .prepare('SELECT request_id FROM career_actions WHERE user_id=? AND revision=?')
        .bind(user, saved.revision)
        .first()
    ).request_id;
    const duplicate = await call('/api/career', { ...command, requestId: winningId }, user);
    assert.equal(duplicate.body.revision, saved.revision);
    assert.equal(duplicate.body.state.liveMatch.cursor, 1);
    assert.ok(
      saved.state.roster.every(
        (p) => p.potential === 0 && !('potential' in (p.rating?.base || {})),
      ),
    );
    const raw = JSON.parse(
      (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
    );
    assert.ok(raw.roster.some((p) => p.potential > 0));
    assert.ok(raw.liveMatch.opponents.flat().some((p) => p.potential > 0));
    assert.deepEqual(
      {
        budget: saved.state.budget,
        day: saved.state.day,
        history: saved.state.history,
        standings: saved.state.standings,
      },
      baseline,
    );
    const denied = await call(
      '/api/career',
      { type: 'start', club: 'kbo-lg', mode: 'short', replace: true, revision: saved.revision },
      user,
    );
    assert.equal(denied.status, 400);
    let steps = 0;
    while (!saved.state.liveMatch.finished && steps++ < 400)
      saved = await action({ type: 'stepMatch' }, user);
    assert.ok(saved.state.liveMatch.finished);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM projection_probe').first()).n, 0);
    const final = saved.state.liveMatch.result;
    saved = await action({ type: 'completeMatch' }, user);
    assert.equal(saved.state.liveMatch, undefined);
    assert.deepEqual(saved.state.history[0].log, final.log);
    assert.equal(saved.state.day, baseline.day + 1);
    const archive = await call(
      '/api/career/matches/' + encodeURIComponent(saved.state.history[0].id),
      undefined,
      user,
    );
    assert.deepEqual(archive.body.log, final.log);
    assert.ok((await db.prepare('SELECT COUNT(*) AS n FROM projection_probe').first()).n > 0);
    const ledger = await db
      .prepare('SELECT SUM(amount) AS n FROM finance_entries WHERE user_id=?')
      .bind(user)
      .first();
    assert.ok(Math.abs(ledger.n - saved.state.budget) < 1e-7);
    await db.batch([
      db.prepare('DROP TRIGGER observe_player_projection'),
      db.prepare('DROP TRIGGER observe_contract_projection'),
      db.prepare('DROP TABLE projection_probe'),
    ]);
  },
  { timeout: 60000 },
);

test('Potential visibility follows each career on catalog, negotiation and conflict responses', async () => {
  const user = 'visibility';
  let saved = await action(
    { type: 'start', club: 'kbo-lotte', mode: 'short', revealPotential: true },
    user,
  );
  assert.ok(saved.state.roster.some((p) => p.potential > 0));
  assert.ok(
    (await call('/api/catalog', undefined, user)).body.players.some((p) => p.potential > 0),
  );
  saved = await action({ type: 'start', club: 'kbo-lg', mode: 'short', replace: true }, user);
  const catalog = (await call('/api/catalog', undefined, user)).body;
  assert.ok(catalog.players.every((p) => p.potential === 0));
  const p = catalog.players.find((p) => p.club === 'fa');
  saved = await action({ type: 'negotiate', id: p.id, salary: p.salary * 2, years: 3 }, user);
  assert.equal(saved.state.deals[0].player.potential, 0);
  const conflict = await call(
    '/api/career',
    { type: 'training', value: 'rest', revision: 0 },
    user,
  );
  assert.equal(conflict.status, 409);
  assert.ok(conflict.body.state.roster.every((p) => p.potential === 0));
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.ok(raw.deals[0].player.potential > 0);
});

test('Bullpen groups upgrade legacy D1 saves without changing data and persist through commands and reads', async () => {
  const user = 'pitcher-groups';
  let saved = await action({ type: 'start', club: 'kbo-lotte', mode: 'short' }, user);
  const original = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  delete original.pitching.setup;
  delete original.pitching.chase;
  const legacy = JSON.stringify(original);
  await db.prepare('UPDATE careers SET state=? WHERE user_id=?').bind(legacy, user).run();
  saved = (await call('/api/career', undefined, user)).body;
  assert.ok(saved.state.pitching.setup.length && saved.state.pitching.chase.length);
  assert.equal(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
    legacy,
  );
  const pitcher = saved.state.pitching.bullpen[0];
  saved = await action({ type: 'pitchingRole', id: pitcher, role: 'chase' }, user);
  const restored = (await call('/api/career', undefined, user)).body;
  const stored = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.deepEqual(restored.state.pitching, stored.pitching);
  assert.ok(stored.pitching.chase.includes(pitcher) && !stored.pitching.setup.includes(pitcher));
  for (const field of ['starter', 'lineup', 'roster', 'budget', 'history', 'day'])
    assert.deepEqual(stored[field], original[field]);
  const invalid = await call(
    '/api/career',
    { type: 'pitchingRole', id: pitcher, role: 'invalid', revision: restored.revision },
    user,
  );
  assert.equal(invalid.status, 400);
  assert.equal((await call('/api/career', undefined, user)).body.revision, restored.revision);
});
