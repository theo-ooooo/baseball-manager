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

test('Live commands save a large career with a bounded patch, retain watched events and deduplicate atomically', async () => {
  const user = 'large-match-command';
  await action({ type: 'start', club: 'kbo-lotte', manager: 'Large command', mode: 'short' }, user);
  for (let i = 0; i < 35; i++) {
    const next = await action({ type: 'continue' }, user);
    if (next.state.progress?.stop === 'fixture') break;
  }
  const initial = await action({ type: 'startMatch' }, user);
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  const live = raw.liveMatch,
    own = live.home === raw.club ? 1 : 0;
  raw.history = Array.from({ length: 5 }, (_, i) => ({
    ...live.timeline,
    id: `archive-large-${i}`,
    day: -28 + i,
  }));
  raw.news.push({
    id: 'large-report',
    title: 'Long report',
    body: '',
    read: true,
    day: raw.day,
    type: 'league',
  });
  raw.news.at(-1).body = 'x'.repeat(Math.max(0, 1_795_000 - JSON.stringify(raw).length));
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const cursor = live.timeline.log.findLastIndex(
    (event) => event.half === own && event.play?.before.outs < 3,
  );
  assert.ok(cursor > 20);
  const payload = {
    type: 'matchCommand',
    command: 'contactFocus',
    cursor,
    timelineVersion: 1,
    responseMode: 'patch',
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const response = await call('/api/career', payload, user);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(Object.keys(response.body.patch), ['liveMatch']);
  assert.equal(response.body.patch.liveMatch.prepared, undefined);
  assert.equal(response.body.patch.liveMatch.opponents, undefined);
  assert.ok(JSON.stringify(response.body).length < 160_000);
  assert.deepEqual(
    response.body.patch.liveMatch.timeline.log.slice(0, cursor),
    live.timeline.log.slice(0, cursor),
  );
  const saved = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.ok(JSON.stringify(saved).length > 1_800_000, 'reproduces the old whole-save rejection');
  const { liveMatch: changed, ...remaining } = saved;
  const { liveMatch: old, ...before } = raw;
  assert.equal(old.cursor, 0);
  assert.deepEqual(remaining, before);
  assert.equal(changed.commands.at(-1).kind, 'contactFocus');
  assert.ok(changed.prepared.input.roster.some((p) => p.potential > 0));
  assert.deepEqual((await call('/api/career', payload, user)).body, response.body);
  assert.equal(
    (await call('/api/career', { ...payload, requestId: crypto.randomUUID() }, user)).status,
    409,
  );
  assert.equal((await call('/api/career', payload, 'different-owner')).status, 409);
  const bad = await call(
    '/api/career',
    {
      ...payload,
      command: 'invalid',
      revision: response.body.revision,
      timelineVersion: 2,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(bad.status, 400);
  const cancel = {
    type: 'cancelMatchCommand',
    cursor,
    timelineVersion: 2,
    responseMode: 'patch',
    revision: response.body.revision,
  };
  const competing = await Promise.all(
    [0, 1].map(() => call('/api/career', { ...cancel, requestId: crypto.randomUUID() }, user)),
  );
  assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await call('/api/career', payload, user)).status, 409);
  // A later full save archives duplicate retained playback before compacting it.
  const current = competing.find((r) => r.status === 201).body;
  const finish = {
    type: 'completeMatch',
    cursor: current.patch.liveMatch.timeline.log.length,
    timelineVersion: current.patch.liveMatch.timelineVersion,
    revision: current.revision,
    requestId: crypto.randomUUID(),
  };
  const completed = await call('/api/career', finish, user);
  assert.equal(completed.status, 201, JSON.stringify(completed.body).slice(0, 500));
  for (const result of raw.history) {
    const archive = await call('/api/career/matches/' + result.id, undefined, user);
    assert.equal(archive.status, 200);
    assert.deepEqual(archive.body, result);
  }
  assert.ok(completed.body.state.history.every((m) => m.log.length === 0));
  assert.equal(completed.body.state.liveMatch, undefined);
});

test('Match card choices persist once in D1 and survive the compact in-game command path', async () => {
  const user = 'match-card-draft-owner';
  await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Card draft', mode: 'short', preseason: false },
    user,
  );
  // This test needs a playable opening day; cancellation has its own API coverage.
  await db
    .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',0) WHERE user_id=?")
    .bind(user)
    .run();
  const initial = await action({ type: 'startMatch', matchCards: true }, user);
  assert.equal(initial.state.liveMatch.weather.sky, 'clear');
  assert.equal(initial.state.liveMatch.weather.cancellation, undefined);
  const live = initial.state.liveMatch,
    draft = live.cards;
  assert.equal(draft.offered.length, 5);
  assert.equal(draft.selected, undefined);
  const payload = {
    type: 'chooseMatchCards',
    draftId: draft.id,
    ids: draft.offered.slice(0, 3).map((c) => c.id),
    cursor: 0,
    timelineVersion: live.timelineVersion,
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const choice = await call('/api/career', payload, user);
  assert.equal(choice.status, 201, JSON.stringify(choice.body));
  assert.equal(choice.body.state.liveMatch.cards.selected.length, 3);
  assert.equal(choice.body.state.liveMatch.prepared, undefined);
  assert.deepEqual((await call('/api/career', payload, user)).body, choice.body);
  const reloaded = await call('/api/career', undefined, user);
  assert.deepEqual(reloaded.body.state.liveMatch.cards, choice.body.state.liveMatch.cards);
  const timeline = reloaded.body.state.liveMatch.timeline;
  const command = {
    type: 'matchCommand',
    command:
      timeline.log[1].half === (live.home === initial.state.club ? 1 : 0)
        ? 'contactFocus'
        : 'attackBatter',
    cursor: 1,
    timelineVersion: reloaded.body.state.liveMatch.timelineVersion,
    revision: reloaded.body.revision,
    responseMode: 'patch',
    requestId: crypto.randomUUID(),
  };
  const revised = await call('/api/career', command, user);
  assert.equal(revised.status, 201, JSON.stringify(revised.body));
  assert.deepEqual(revised.body.patch.liveMatch.cards, choice.body.state.liveMatch.cards);
  assert.deepEqual(revised.body.patch.liveMatch.timeline.log.slice(0, 1), timeline.log.slice(0, 1));
  assert.deepEqual((await call('/api/career', command, user)).body, revised.body);
  const prepared = revised.body.patch.liveMatch;
  const held = prepared.cards.offered.filter((card) => prepared.cards.selected.includes(card.id));
  const ownHalf = prepared.home === initial.state.club ? 1 : 0;
  const target = prepared.timeline.log
    .flatMap((_, cursor) => held.map((card) => ({ cursor, card })))
    .find(({ cursor, card }) => {
      const previous = prepared.timeline.log[cursor - 1],
        after = previous?.play?.after;
      if (
        cursor < prepared.cursor ||
        !after ||
        after.outs >= 3 ||
        !(after.bases[1] || after.bases[2])
      )
        return false;
      if (
        ['power', 'contact', 'pitcherPressure'].includes(card.kind) !==
        (previous.half === ownHalf)
      )
        return false;
      return (
        card.kind !== 'nullify' ||
        !prepared.timeline.log.slice(0, cursor).some((event) => event.play?.augmentations?.opponent)
      );
    });
  assert.ok(target);
  const use = {
    type: 'useMatchCard',
    draftId: prepared.cards.id,
    cardId: target.card.id,
    cursor: target.cursor,
    timelineVersion: prepared.timelineVersion,
    revision: revised.body.revision,
    responseMode: 'patch',
    requestId: crypto.randomUUID(),
  };
  const consumed = await call('/api/career', use, user);
  assert.equal(consumed.status, 201, JSON.stringify(consumed.body));
  assert.deepEqual(consumed.body.patch.liveMatch.cards.used, [
    { cardId: target.card.id, cursor: target.cursor },
  ]);
  assert.deepEqual(
    consumed.body.patch.liveMatch.timeline.log.slice(0, target.cursor),
    prepared.timeline.log.slice(0, target.cursor),
  );
  assert.deepEqual((await call('/api/career', use, user)).body, consumed.body);
  const afterUse = await call('/api/career', undefined, user);
  assert.deepEqual(
    afterUse.body.state.liveMatch.cards.used,
    consumed.body.patch.liveMatch.cards.used,
  );
  const duplicate = await call(
    '/api/career',
    {
      ...use,
      revision: afterUse.body.revision,
      timelineVersion: afterUse.body.state.liveMatch.timelineVersion,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(duplicate.status, 400);
});

test('Growing world progress moves to atomic snapshot parts and survives reload, retry, races and career reset', async () => {
  const user = 'split-world-snapshot';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Split world', mode: 'short', preseason: false },
    user,
  );
  const row = await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first();
  const raw = JSON.parse(row.state);
  const proof = 'world⚾'.repeat(210_000);
  raw.simulation.proof = proof;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const request = {
    type: 'auto',
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const saved = await call('/api/career', request, user);
  assert.equal(saved.status, 201, JSON.stringify(saved.body).slice(0, 300));
  assert.equal(saved.body.state.simulation.proof, proof);
  const storage = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.equal(storage.simulation, undefined);
  assert.ok(storage.__worldParts > 2);
  assert.ok(JSON.stringify(storage).length < 500_000);
  const parts = (
    await db
      .prepare('SELECT part,data FROM career_snapshot_parts WHERE user_id=? ORDER BY part')
      .bind(user)
      .all()
  ).results;
  assert.equal(parts.length, storage.__worldParts);
  assert.ok(parts.every((p) => new TextEncoder().encode(p.data).length < 600_000));
  assert.equal(JSON.parse(parts.map((p) => p.data).join('')).proof, proof);
  assert.equal((await call('/api/career', undefined, user)).body.state.simulation.proof, proof);
  assert.equal((await call('/api/career', request, user)).body.revision, saved.body.revision);
  const race = await Promise.all(
    [0, 1].map(() =>
      call(
        '/api/career',
        { ...request, revision: saved.body.revision, requestId: crypto.randomUUID() },
        user,
      ),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await call('/api/career', undefined, user)).body.state.simulation.proof, proof);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM career_snapshot_parts WHERE user_id=?')
        .bind('different-user')
        .first()
    ).n,
    0,
  );
  await action(
    {
      type: 'start',
      replace: true,
      club: 'kbo-lotte',
      manager: 'Reset',
      mode: 'short',
      preseason: false,
    },
    user,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM career_snapshot_parts WHERE user_id=?')
        .bind(user)
        .first()
    ).n,
    0,
  );
});

test('D1 individual training persists once without altering existing abilities, contracts, records or finances', async () => {
  const user = 'individual-training-career';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Training DB', mode: 'full' },
    user,
  );
  const player = initial.state.roster.find((p) => !p.real && p.pos !== 'P');
  const command = {
    type: 'setTrainingPlan',
    id: player.id,
    focus: 'contact',
    intensity: 'normal',
    restDays: [1, 4],
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const assigned = await call('/api/career', command, user);
  assert.equal(assigned.status, 201);
  const saved = assigned.body;
  assert.equal(saved.revision, initial.revision + 1);
  assert.equal(saved.state.budget, initial.state.budget);
  assert.equal(saved.state.expenses, initial.state.expenses);
  const oldRoster = structuredClone(saved.state.roster);
  delete oldRoster.find((p) => p.id === player.id).trainingPlan;
  assert.deepEqual(oldRoster, initial.state.roster);
  assert.deepEqual((await call('/api/career', command, user)).body, saved);
  assert.deepEqual((await call('/api/career', undefined, user)).body, saved);
  const continued = await action({ type: 'continueDay', simulateGames: true }, user);
  assert.deepEqual(
    continued.state.roster.find((p) => p.id === player.id).trainingPlan,
    saved.state.roster.find((p) => p.id === player.id).trainingPlan,
  );
  const cleared = await action({ type: 'clearTrainingPlan', id: player.id }, user);
  assert.equal(cleared.state.roster.find((p) => p.id === player.id).trainingPlan, undefined);
  assert.equal(
    (await call('/api/career', undefined, user)).body.state.roster.find((p) => p.id === player.id)
      .trainingPlan,
    undefined,
  );
});

test('D1 scouting persists missions and reports, hides discoveries until due and charges once', async () => {
  const user = 'scout-career';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Scout DB', mode: 'full' },
    user,
  );
  const scout = initial.state.staff.find((c) => c.role === '스카우트');
  const command = {
    type: 'assignScout',
    league: 'kbo',
    pos: 'P',
    maxAge: 25,
    days: 7,
    scoutId: scout.id,
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const assigned = await call('/api/career', command, user);
  assert.equal(assigned.status, 201);
  let saved = assigned.body;
  assert.equal(saved.state.scouting.assignments[0].candidateIds, undefined);
  assert.equal(saved.state.budget, initial.state.budget - 4);
  assert.deepEqual(saved.state.roster, initial.state.roster);
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.equal(raw.scouting.assignments[0].candidateIds.length, 3);
  assert.equal((await call('/api/career', command, user)).body.revision, saved.revision);
  assert.deepEqual((await call('/api/career', undefined, user)).body, saved);
  for (let i = 0; i < 7; i++) saved = await action({ type: 'advance', count: 1 }, user);
  assert.equal(saved.state.scouting.reports.length, 3);
  assert.equal(saved.state.scouting.assignments[0].status, 'completed');
  assert.deepEqual(
    (await call('/api/career', undefined, user)).body.state.scouting,
    saved.state.scouting,
  );
  assert.ok(
    !saved.state.scouting.reports.some((r) => 'potential' in r || 'potential' in r.abilities),
  );
  const selected = saved.state.scouting.reports[0].playerId;
  saved = await action({ type: 'shortlistPlayer', id: selected, add: true }, user);
  assert.deepEqual(saved.state.scouting.shortlist, [selected]);
  assert.deepEqual((await call('/api/career', undefined, user)).body.state.scouting.shortlist, [
    selected,
  ]);
});

test('D1 timeline revisions preserve consumed events, hide inputs and commit a saved result once', async () => {
  const user = 'timeline-revision';
  await action({ type: 'start', club: 'kbo-lotte', manager: 'Timeline DB', mode: 'short' }, user);
  for (let i = 0; i < 35; i++) {
    const next = await action({ type: 'continue' }, user);
    for (const n of next.state.news.filter((n) => n.choiceKind && !n.choice))
      await action({ type: 'respondNews', id: n.id, choice: 'explain' }, user);
    if (next.state.progress?.stop === 'fixture') break;
  }
  const initial = await action({ type: 'startMatch' }, user);
  const live = initial.state.liveMatch,
    cursor = 12,
    side = live.home === initial.state.club ? 1 : 0;
  const command = {
    type: 'reviseMatch',
    cursor,
    timelineVersion: live.timelineVersion,
    lineup: initial.state.lineup,
    pitcher:
      live.timeline.log
        .slice(0, cursor)
        .filter((e) => e.half !== side && e.play)
        .at(-1)?.play.pitcher || initial.state.starter,
    instructions: { ...initial.state.instructions, power: 100 },
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  command.defense = { ...live.timeline.replayTeams[side].defense, P: command.pitcher };
  const invalidDefense = await call(
    '/api/career',
    {
      ...command,
      defense: { ...command.defense, LF: command.defense.CF },
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(invalidDefense.status, 400);
  assert.deepEqual((await call('/api/career', undefined, user)).body, initial);
  const changed = await call('/api/career', command, user);
  assert.equal(changed.status, 201);
  assert.equal(changed.body.state.liveMatch.timelineVersion, 2);
  assert.equal(changed.body.state.liveMatch.prepared, undefined);
  assert.deepEqual(
    changed.body.state.liveMatch.timeline.log.slice(0, cursor),
    live.timeline.log.slice(0, cursor),
  );
  assert.deepEqual(changed.body.state.roster, initial.state.roster);
  assert.equal(changed.body.state.budget, initial.state.budget);
  const duplicate = await call('/api/career', command, user);
  assert.equal(duplicate.body.revision, changed.body.revision);
  assert.equal(duplicate.body.state.liveMatch.timelineVersion, 2);
  const rejected = await call(
    '/api/career',
    { ...command, revision: changed.body.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(rejected.status, 400);
  const afterReject = (await call('/api/career', undefined, user)).body;
  assert.equal(afterReject.revision, changed.body.revision);
  assert.deepEqual(afterReject.state.liveMatch.timeline, changed.body.state.liveMatch.timeline);
  const complete = {
    type: 'completeMatch',
    cursor: afterReject.state.liveMatch.timeline.log.length,
    timelineVersion: 2,
    revision: afterReject.revision,
    requestId: crypto.randomUUID(),
  };
  const finished = await call('/api/career', complete, user);
  assert.equal(finished.status, 201);
  assert.equal(finished.body.state.history.length, initial.state.history.length + 1);
  assert.deepEqual(finished.body.state.history.slice(1), initial.state.history);
  const repeated = await call('/api/career', complete, user);
  assert.equal(repeated.body.revision, finished.body.revision);
  assert.deepEqual(repeated.body.state.history, finished.body.state.history);
  const record = await call(
    '/api/career/matches/' + encodeURIComponent(finished.body.state.history[0].id),
    undefined,
    user,
  );
  assert.deepEqual(record.body.log, afterReject.state.liveMatch.timeline.log);
});

test('D1 direct instructions persist once, preserve watched events and keep preseason stats separate', async () => {
  const user = 'match-command-career';
  await action({ type: 'start', club: 'kbo-lotte', manager: 'Command DB', mode: 'short' }, user);
  for (let i = 0; i < 35; i++) {
    const next = await action({ type: 'continue' }, user);
    for (const n of next.state.news.filter((n) => n.choiceKind && !n.choice))
      await action({ type: 'respondNews', id: n.id, choice: 'explain' }, user);
    if (next.state.progress?.stop === 'fixture') break;
  }
  const initial = await action({ type: 'startMatch' }, user);
  const live = initial.state.liveMatch,
    own = live.home === initial.state.club ? 1 : 0;
  const cursor = live.timeline.log.findIndex((_, i) => {
    const event = live.timeline.log[i - 1],
      state = event?.play?.after;
    return i > 0 && event.half === own && state?.outs < 3 && state.bases[0] && !state.bases[1];
  });
  assert.ok(cursor > 0);
  const payload = {
    type: 'matchCommand',
    command: 'stealSecond',
    cursor,
    timelineVersion: 1,
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const changed = await call('/api/career', payload, user);
  assert.equal(changed.status, 201);
  assert.equal(changed.body.revision, initial.revision + 1);
  assert.deepEqual(changed.body.state.roster, initial.state.roster);
  assert.deepEqual(
    changed.body.state.liveMatch.timeline.log.slice(0, cursor),
    live.timeline.log.slice(0, cursor),
  );
  assert.equal(changed.body.state.liveMatch.timeline.log[cursor].play.plateAppearance, false);
  assert.equal(changed.body.state.liveMatch.prepared, undefined);
  assert.deepEqual((await call('/api/career', payload, user)).body, changed.body);
  assert.deepEqual((await call('/api/career', undefined, user)).body, changed.body);
  const finalPayload = {
    type: 'completeMatch',
    cursor: changed.body.state.liveMatch.timeline.log.length,
    timelineVersion: 2,
    revision: changed.body.revision,
    requestId: crypto.randomUUID(),
  };
  const final = await call('/api/career', finalPayload, user);
  assert.equal(final.status, 201);
  assert.deepEqual((await call('/api/career', finalPayload, user)).body, final.body);
  const record = await call(
    '/api/career/matches/' + encodeURIComponent(final.body.state.history[0].id),
    undefined,
    user,
  );
  assert.deepEqual(record.body.log, changed.body.state.liveMatch.timeline.log);
  assert.deepEqual(
    final.body.state.roster.map((p) => p.stats),
    initial.state.roster.map((p) => p.stats),
  );
});

test('Compact mutation responses omit archived playback without changing stored match data or duplicate semantics', async () => {
  const user = 'compact-response-career';
  await action({ type: 'start', club: 'kbo-lotte', manager: 'Compact DB', mode: 'short' }, user);
  for (let i = 0; i < 35; i++) {
    const next = await action({ type: 'continue' }, user);
    for (const n of next.state.news.filter((n) => n.choiceKind && !n.choice))
      await action({ type: 'respondNews', id: n.id, choice: 'explain' }, user);
    if (next.state.progress?.stop === 'fixture') break;
  }
  const initial = await action({ type: 'continue' }, user);
  assert.ok(initial.state.history[0].log.length > 0);
  const ids = [...initial.state.lineup];
  [ids[0], ids[1]] = [ids[1], ids[0]];
  const command = {
    type: 'lineup',
    ids,
    responseMode: 'compact',
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const saved = await call('/api/career', command, user);
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.body.state.lineup, ids);
  assert.equal(saved.body.state.history[0].log.length, 0);
  assert.equal(saved.body.state.history[0].replayTeams, undefined);
  assert.deepEqual((await call('/api/career', command, user)).body, saved.body);
  const full = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(full.state.history, initial.state.history);
  assert.ok(JSON.stringify(saved.body).length < JSON.stringify(full).length);
  const archived = await call(
    '/api/career/matches/' + encodeURIComponent(full.state.history[0].id),
    undefined,
    user,
  );
  assert.deepEqual(archived.body, initial.state.history[0]);
  const team = await action(
    {
      type: 'teamInstructions',
      preset: 'power',
      value: { power: 85, patience: 35, steal: 15, depth: 50 },
      responseMode: 'compact',
    },
    user,
  );
  assert.equal(team.state.tactic, 'power');
  assert.deepEqual(team.state.instructions, { power: 85, patience: 35, steal: 15, depth: 50 });
  assert.equal(team.revision, saved.body.revision + 1);
  const invalid = await call(
    '/api/career',
    {
      type: 'teamInstructions',
      preset: 'unknown',
      value: { power: 85, patience: 35, steal: 15, depth: 50 },
      revision: team.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(invalid.status, 400);
  const unchanged = (await call('/api/career', undefined, user)).body;
  assert.equal(unchanged.revision, team.revision);
  assert.deepEqual(unchanged.state.roster, initial.state.roster);
  assert.equal(unchanged.state.budget, initial.state.budget);
});

test('D1 post-match media saves canonical messages and actual mood reactions once without rewriting the result', async () => {
  const user = 'media-conversation-career';
  await action({ type: 'start', club: 'kbo-lotte', manager: 'Media DB', mode: 'short' }, user);
  for (let i = 0; i < 35; i++) {
    const next = await action({ type: 'continue' }, user);
    for (const n of next.state.news.filter((n) => n.choiceKind && !n.choice))
      await action({ type: 'respondNews', id: n.id, choice: 'explain' }, user);
    if (next.state.progress?.stop === 'fixture') break;
  }
  const live = await action({ type: 'startMatch' }, user);
  const before = await action(
    { type: 'completeMatch', cursor: live.state.liveMatch.timeline.log.length, timelineVersion: 1 },
    user,
  );
  const pending = before.state.media.pending;
  assert.equal(pending.key, 'post:' + before.state.history[0].id);
  const command = {
    type: 'matchConversation',
    stage: 'post',
    key: pending.key,
    answers: pending.questions.map((q) => ({
      id: q.id,
      choice: 'challenge',
      text: 'forged quote',
    })),
    revision: before.revision,
    requestId: crypto.randomUUID(),
  };
  const result = await call('/api/career', command, user);
  assert.equal(result.status, 201);
  const saved = result.body,
    record = saved.state.media.journal[0];
  assert.equal(saved.revision, before.revision + 1);
  assert.equal(saved.state.media.pending, undefined);
  assert.ok(record.answers.every((a) => a.text !== 'forged quote'));
  assert.deepEqual(saved.state.history, before.state.history);
  assert.equal(saved.state.day, before.state.day);
  assert.equal(saved.state.budget, before.state.budget);
  for (const r of record.reactions) {
    assert.ok(Math.abs(r.after - r.before) <= 2);
    assert.equal(saved.state.roster.find((p) => p.id === r.id).mood.value, r.after);
  }
  const strip = (players) =>
    players.map((p) => {
      const copy = { ...p };
      delete copy.mood;
      return copy;
    });
  assert.deepEqual(strip(saved.state.roster), strip(before.state.roster));
  assert.deepEqual((await call('/api/career', command, user)).body, saved);
  assert.deepEqual((await call('/api/career', undefined, user)).body, saved);
  const again = await call(
    '/api/career',
    { ...command, revision: saved.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(again.status, 400);
  assert.deepEqual((await call('/api/career', undefined, user)).body, saved);
});

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
  assert.equal(catalog.body.players.length, 4504);
  assert.equal(catalog.body.players.filter((p) => p.real).length, 2043);
  assert.equal(new Set(catalog.body.players.map((p) => p.id)).size, 4504);
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
  const raw = await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first();
  const stored = JSON.parse(raw.state);
  assert.ok(stored.roster.every((p) => p.development.curve && p.development.lastTrained));
  assert.ok(loaded.state.roster.every((p) => !p.development.curve));
  const player = loaded.state.roster[0];
  const row = await db
    .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
    .bind(user, player.id)
    .first();
  assert.deepEqual(
    JSON.parse(row.data).development,
    stored.roster.find((p) => p.id === player.id).development,
  );
});

test('Negotiation, signing, reselling and coaches update relational rows and accounting atomically', async () => {
  const catalog = (await call('/api/catalog')).body;
  const p = catalog.players.find((p) => p.club === 'fa');
  const quote = await call(`/api/career/contracts/${p.id}/quote`);
  assert.equal(quote.status, 200);
  let negotiated = await action({
    type: 'negotiate',
    id: p.id,
    salary: quote.body.salary * 1.2,
    years: 3,
    freeAgentTerms: { salary: 1, years: 1, basis: 'forged' },
  });
  assert.deepEqual(negotiated.state.deals[0].freeAgentTerms, quote.body);
  assert.equal(negotiated.state.deals[0].status, 'pending');
  const premature = await call('/api/career', {
    type: 'sign',
    id: negotiated.state.deals[0].id,
    revision: negotiated.revision,
  });
  assert.equal(premature.status, 400);
  while (negotiated.state.deals[0].status === 'pending')
    negotiated = await action({ type: 'advance', count: 1 });
  assert.notEqual(negotiated.state.deals[0].status, 'rejected');
  const agreed = negotiated;
  const revisionCommand = {
    type: 'reviseContractSalary',
    kind: 'player',
    id: agreed.state.deals[0].id,
    salary: agreed.state.deals[0].salary * 0.95,
    revision: agreed.revision,
    requestId: crypto.randomUUID(),
  };
  const revised = await call('/api/career', revisionCommand);
  assert.equal(revised.status, 201);
  negotiated = revised.body;
  assert.equal(negotiated.state.deals[0].status, 'pending');
  assert.equal(negotiated.state.deals[0].salary, revisionCommand.salary);
  assert.deepEqual(negotiated.state.roster, agreed.state.roster);
  assert.equal(negotiated.state.budget, agreed.state.budget);
  assert.deepEqual(negotiated.ledger, agreed.ledger);
  assert.deepEqual((await call()).body, negotiated);
  assert.equal((await call('/api/career', revisionCommand)).body.revision, negotiated.revision);
  const oldSignature = await call('/api/career', {
    type: 'sign',
    id: revisionCommand.id,
    revision: negotiated.revision,
  });
  assert.equal(oldSignature.status, 400);
  assert.deepEqual((await call()).body, negotiated);
  while (negotiated.state.deals[0].status === 'pending')
    negotiated = await action({ type: 'advance', count: 1 });
  assert.equal(negotiated.state.deals[0].status, 'accepted');
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
  let coached = await action({
    type: 'coachOffer',
    id: coach.id,
    salary: coach.salary * 2,
    years: 3,
  });
  assert.equal(coached.state.coachDeals[0].status, 'pending');
  const coachDealId = coached.state.coachDeals[0].id;
  const waiting = (await call()).body;
  assert.equal(waiting.state.coachDeals[0].id, coachDealId);
  while (coached.state.coachDeals[0].status === 'pending')
    coached = await action({ type: 'advance', count: 1 });
  coached = await action({ type: 'signCoach', id: coachDealId });
  const closedCoachMail = coached.state.news.filter((n) => n.dealId === coachDealId);
  assert.ok(closedCoachMail.length);
  assert.ok(closedCoachMail.every((n) => n.contractResolution === 'signed'));
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
    const renewal = saved.state.managerCareer?.offers.find(
      (o) => o.source === 'renewal' && o.status === 'offered',
    );
    if (renewal) {
      saved = await action({
        type: 'acceptManagerTerms',
        id: renewal.id,
        termsVersion: renewal.contractTerms.version,
      });
      const terms = saved.state.managerCareer.offers.find((o) => o.id === renewal.id).contractTerms;
      saved = await action({
        type: 'signManager',
        id: renewal.id,
        termsVersion: terms.version,
        signature: saved.state.manager,
      });
    }
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
    for (let i = 0; i < 35; i++) {
      saved = await action({ type: 'continue' }, user);
      if (saved.state.progress?.stop === 'fixture') break;
    }
    saved = await action({ type: 'startMatch' }, user);
    assert.equal(saved.state.liveMatch.result.log.length, 0);
    assert.equal(saved.state.liveMatch.opponents, undefined);
    assert.equal(saved.state.liveMatch.prepared, undefined);
    assert.ok(saved.state.liveMatch.timeline.log.length > 20);
    const generatedTimeline = saved.state.liveMatch.timeline;
    const baseline = {
      budget: saved.state.budget,
      day: saved.state.day,
      history: saved.state.history,
      standings: saved.state.standings,
    };
    await db.batch([
      db.prepare('CREATE TABLE projection_probe (event TEXT)'),
      db.prepare(
        "CREATE TRIGGER observe_player_projection AFTER UPDATE ON career_players BEGIN INSERT INTO projection_probe VALUES('player'); END",
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
    assert.ok(raw.liveMatch.prepared.input.roster.some((p) => p.potential > 0));
    assert.deepEqual(raw.liveMatch.timeline, generatedTimeline);
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
    saved = await action(
      { type: 'matchCursor', cursor: generatedTimeline.log.length, timelineVersion: 1 },
      user,
    );
    assert.deepEqual(saved.state.liveMatch.timeline, generatedTimeline);
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

test('Routine news and tactic saves leave projections untouched; a player edit updates only that row', async () => {
  const user = 'delta-write-cost';
  let saved = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Delta', mode: 'short' },
    user,
  );
  const tables = [
    'career_players',
    'contracts',
    'career_staff',
    'negotiations',
    'career_standings',
  ];
  await db.prepare('CREATE TABLE delta_probe (table_name TEXT, operation TEXT)').run();
  const triggers = tables.flatMap((table) =>
    ['INSERT', 'UPDATE', 'DELETE'].map((operation) => ({
      name: `delta_${table}_${operation}`,
      table,
      operation,
    })),
  );
  try {
    await db.batch(
      triggers.map(({ name, table, operation }) =>
        db.prepare(
          `CREATE TRIGGER ${name} AFTER ${operation} ON ${table} BEGIN INSERT INTO delta_probe VALUES('${table}','${operation}'); END`,
        ),
      ),
    );
    saved = await action({ type: 'readNews', id: saved.state.news[0].id }, user);
    saved = await action({ type: 'tactic', value: 'power' }, user);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM delta_probe').first()).n, 0);
    const player = saved.state.roster.find((p) => p.pos === 'IF');
    saved = await action({ type: 'positionTraining', id: player.id, position: 'SS' }, user);
    assert.deepEqual((await db.prepare('SELECT * FROM delta_probe').all()).results, [
      { table_name: 'career_players', operation: 'UPDATE' },
    ]);
    const projected = await db
      .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
      .bind(user, player.id)
      .first();
    assert.equal(JSON.parse(projected.data).positionTraining, 'SS');
    const ledger = (
      await db
        .prepare(
          'SELECT id,revision,season AS year,day,kind,amount,balance,created_at AS createdAt FROM finance_entries WHERE user_id=? ORDER BY revision DESC LIMIT 60',
        )
        .bind(user)
        .all()
    ).results;
    assert.deepEqual(saved.ledger, ledger);
  } finally {
    await db.batch(triggers.map(({ name }) => db.prepare(`DROP TRIGGER IF EXISTS ${name}`)));
    await db.prepare('DROP TABLE delta_probe').run();
  }
});

test('D1 manager resignation, job eligibility, employment and club preservation survive reloads and duplicate requests', async () => {
  const user = 'manager-career-db';
  const start = await action(
    { type: 'start', club: 'kbo-lotte', manager: '경력 검증', mode: 'short' },
    user,
  );
  const request = {
    type: 'resignManager',
    confirm: true,
    revision: start.revision,
    requestId: crypto.randomUUID(),
  };
  const resigned = await call('/api/career', request, user);
  assert.equal(resigned.status, 201);
  assert.equal(resigned.body.state.managerCareer.status, 'unemployed');
  assert.deepEqual((await call('/api/career', request, user)).body, resigned.body);
  assert.deepEqual((await call('/api/career', undefined, user)).body, resigned.body);
  const locked = await call(
    '/api/career',
    { type: 'auto', revision: resigned.body.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(locked.status, 400);
  const open = Object.values(resigned.body.state.managerJobs).find(
    (j) => j.club.startsWith('kbo-') && j.club !== 'kbo-lotte' && j.confidence < 35,
  );
  assert.ok(open);
  const applied = await action({ type: 'applyManager', club: open.club, targetRank: 4 }, user);
  assert.equal(applied.state.managerJobs[open.club].managerName, open.managerName);
  const id = applied.state.managerCareer.offers.find((o) => o.club === open.club).id;
  let progressed = applied;
  for (let i = 0; i < 3; i++) progressed = await action({ type: 'managerContinue' }, user);
  const offer = progressed.state.managerCareer.offers.find((o) => o.id === id);
  assert.equal(offer.status, 'interview');
  for (const [question, answer] of [
    ['motivation', 'project'],
    ['career', 'responsibility'],
    ['style', offer.priority],
    ['target', 'agree'],
    ['budget', 'within'],
    ['staff', 'keep'],
  ])
    progressed = await action({ type: 'managerInterview', id, question, answer }, user);
  assert.equal(progressed.state.managerCareer.offers.find((o) => o.id === id).status, 'pending');
  for (let i = 0; i < 2; i++) progressed = await action({ type: 'managerContinue' }, user);
  const terms = progressed.state.managerCareer.offers.find((o) => o.id === id).contractTerms;
  const agreement = {
    type: 'acceptManagerTerms',
    id,
    termsVersion: terms.version,
    revision: progressed.revision,
    requestId: crypto.randomUUID(),
  };
  const accepted = await call('/api/career', agreement, user);
  assert.equal(accepted.status, 201);
  assert.deepEqual((await call('/api/career', agreement, user)).body, accepted.body);
  assert.equal(accepted.body.state.managerCareer.status, 'unemployed');
  progressed = accepted.body;
  const before = structuredClone(progressed.state.standings);
  const signed = await action(
    {
      type: 'signManager',
      id,
      termsVersion: progressed.state.managerCareer.offers.find((o) => o.id === id).contractTerms
        .version,
      signature: progressed.state.manager,
    },
    user,
  );
  assert.equal(signed.state.club, open.club);
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS n FROM transfers WHERE user_id=?').bind(user).first()).n,
    0,
  ); // Manager changes are not player transfers.
  assert.deepEqual(signed.state.standings, before);
  assert.equal(signed.state.clubCareers, undefined);
  assert.equal(signed.state.managerJobs[open.club].managerName, '경력 검증');
  assert.equal(signed.state.managerJobs[open.club].confidence, 65);
  assert.deepEqual((await call('/api/career', undefined, user)).body, signed);
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.ok(raw.clubCareers['kbo-lotte']);
  assert.ok(raw.transferred.some((p) => p.club === 'kbo-lotte'));
  const catalog = (await call('/api/catalog', undefined, user)).body;
  const foreign = catalog.players.find((p) => p.club.startsWith('npb-'));
  assert.equal(foreign.contact, 0);
  assert.equal(foreign.observation.status, 'unknown');
});

test('Player career archives leave the hot save, isolate users and supply trusted retired coaches', async () => {
  const user = 'longterm-archive-db';
  let saved = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Archive DB', mode: 'short' },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.managerCareer.contract.throughYear = raw.year + 2;
  const retired = raw.roster.find((p) => p.pos === 'P');
  retired.age = 45;
  retired.stats.outs = 90;
  retired.stats.wins = 5;
  raw.phase = 'finished';
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  saved = await action({ type: 'nextSeason' }, user);
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM career_player_records WHERE user_id=?')
    .bind(user)
    .first();
  assert.ok(count.n > 4000);
  const hot = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.equal(hot.pendingRecords, undefined);
  assert.ok(JSON.stringify(hot).length < 1800000);
  const records = await call('/api/records/' + encodeURIComponent(retired.id), undefined, user);
  assert.equal(records.status, 200);
  const record = records.body.find((r) => r.kind === 'retirement');
  assert.equal(record.stats.outs, 90);
  assert.ok(record.coach);
  assert.deepEqual(
    (
      await call(
        '/api/records/' + encodeURIComponent(retired.id),
        undefined,
        'unrelated-archive-user',
      )
    ).body,
    [],
  );
  const forged = await call(
    '/api/career',
    {
      type: 'hireRetiredCoach',
      playerId: 'invented',
      role: '투수',
      retiredCandidate: { id: 'retired-invented', name: 'Forged', skill: 99, salary: 0 },
      revision: saved.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(forged.status, 400);
  saved = await action(
    {
      type: 'hireRetiredCoach',
      playerId: retired.id,
      role: '투수',
      retiredCandidate: { ...record.coach, skill: 99, salary: 0 },
    },
    user,
  );
  assert.equal(saved.state.staff.find((c) => c.id === record.coach.id).skill, record.coach.skill);
  assert.equal(saved.state.staff.find((c) => c.id === record.coach.id).salary, record.coach.salary);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM career_player_records WHERE user_id=?')
        .bind(user)
        .first()
    ).n,
    count.n,
  );
});

test('D1 stores the season start choice, validates it, and a retried preseason skip lands on opening day once', async () => {
  const opener = 'preseason-opening-db';
  const fresh = await call('/api/career', undefined, opener);
  const invalid = await call(
    '/api/career',
    {
      type: 'start',
      club: 'kbo-lotte',
      manager: '검증',
      mode: 'short',
      preseason: 'yes',
      revision: fresh.body.revision,
      requestId: crypto.randomUUID(),
    },
    opener,
  );
  assert.equal(invalid.status, 400);
  assert.equal((await call('/api/career', undefined, opener)).body.state, null);
  const opened = await action(
    { type: 'start', club: 'kbo-lotte', manager: '개막 DB', mode: 'short', preseason: false },
    opener,
  );
  assert.equal(opened.state.day, 0);
  assert.equal(opened.state.phase, 'regular');
  assert.equal(opened.state.rules.preseason, false);
  assert.equal(opened.state.managerCareer.contract.signed, opened.state.calendar.openingDate);
  const storedOpener = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(opener).first()).state,
  );
  assert.equal(storedOpener.rules.preseason, false);
  assert.equal(storedOpener.day, 0);
  const refused = await call(
    '/api/career',
    { type: 'skipPreseason', revision: opened.revision, requestId: crypto.randomUUID() },
    opener,
  );
  assert.equal(refused.status, 400);
  assert.equal((await call('/api/career', undefined, opener)).body.revision, opened.revision);
  const jobless = await action(
    {
      type: 'start',
      club: 'kbo-lg',
      manager: '',
      mode: 'short',
      unemployed: true,
      preseason: false,
    },
    'preseason-unemployed-db',
  );
  assert.equal(jobless.state.day, 0);
  assert.equal(jobless.state.managerCareer.status, 'unemployed');
  assert.equal(jobless.state.managerCareer.unemployedSince, jobless.state.calendar.openingDate);

  const user = 'preseason-skip-db';
  const start = await action(
    { type: 'start', club: 'kbo-lotte', manager: '위임 DB', mode: 'short' },
    user,
  );
  assert.equal(start.state.day, -28);
  assert.equal(start.state.rules.preseason, true);
  const command = {
    type: 'skipPreseason',
    futureSeasons: false,
    revision: start.revision,
    requestId: crypto.randomUUID(),
  };
  const skipped = await call('/api/career', command, user);
  assert.equal(skipped.status, 201);
  assert.equal(skipped.body.state.day, 0);
  assert.equal(skipped.body.state.phase, 'regular');
  assert.equal(skipped.body.state.progress.stop, 'season');
  assert.equal(skipped.body.state.progress.from, -28);
  assert.equal(skipped.body.revision, start.revision + 1);
  assert.equal(skipped.body.state.history.filter((r) => r.friendly).length, 4);
  assert.equal(skipped.body.state.rules.preseason, true);
  assert.equal(skipped.body.state.year, start.state.year);
  assert.equal(
    skipped.body.state.managerCareer.contract.signed,
    start.state.managerCareer.contract.signed,
  );
  assert.ok(skipped.body.state.roster.every((p) => p.stats.g === 0));
  const repeated = await call('/api/career', command, user);
  assert.equal(repeated.status, 201);
  assert.equal(repeated.body.revision, skipped.body.revision);
  assert.equal(repeated.body.state.day, 0);
  assert.equal(repeated.body.state.history.length, skipped.body.state.history.length);
  const stale = await call('/api/career', { ...command, requestId: crypto.randomUUID() }, user);
  assert.equal(stale.status, 409);
  const loaded = (await call('/api/career', undefined, user)).body;
  assert.equal(loaded.revision, skipped.body.revision);
  assert.equal(loaded.state.day, 0);
  assert.equal(loaded.state.phase, 'regular');
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM career_matches WHERE user_id=?')
        .bind(user)
        .first()
    ).n,
    4,
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM career_actions WHERE user_id=? AND kind='skipPreseason'",
        )
        .bind(user)
        .first()
    ).n,
    1,
  );
});

test('D1 bounded manager conversations preserve the rest of a career and safely retry lost responses', async () => {
  const user = 'bounded-manager-qa';
  const started = await action(
    {
      type: 'start',
      club: 'kbo-lotte',
      manager: '무료 검증',
      mode: 'short',
      unemployed: true,
      preseason: false,
    },
    user,
  );
  const raw = async () =>
    JSON.parse(
      (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
    );
  const state = await raw();
  const id = 'bounded-invitation';
  state.managerCareer.offers = [
    {
      id,
      club: 'kbo-samsung',
      status: 'invited',
      salary: 100,
      targetRank: 5,
      priority: 'youth',
      visibility: 'private',
      expires: '2099-12-31',
      due: '2099-12-31',
      message: '면접 초청',
    },
  ];
  state.managerJobs['kbo-samsung'].vacant = true;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(state), user)
    .run();
  const baseline = structuredClone(state);
  delete baseline.managerCareer;
  delete baseline.news;
  const tables = async () => {
    const names = [
      'career_players',
      'contracts',
      'career_staff',
      'career_standings',
      'negotiations',
      'finance_entries',
      'career_matches',
    ];
    return Promise.all(
      names.map(
        async (name) =>
          (await db.prepare(`SELECT * FROM ${name} WHERE user_id=?`).bind(user).all()).results,
      ),
    );
  };
  const projected = await tables();
  let revision = started.revision;
  const send = async (payload) => {
    const command = {
      ...payload,
      id,
      responseMode: 'patch',
      revision,
      requestId: crypto.randomUUID(),
    };
    const result = await call('/api/career', command, user);
    assert.equal(result.status, 201, JSON.stringify(result));
    assert.equal(result.body.baseRevision, revision);
    assert.equal(result.body.revision, revision + 1);
    assert.deepEqual(Object.keys(result.body.patch).sort(), ['managerCareer', 'news']);
    assert.equal(result.body.state, undefined);
    assert.ok(JSON.stringify(result.body).length < 50000);
    assert.deepEqual((await call('/api/career', command, user)).body, result.body);
    revision = result.body.revision;
    const after = await raw();
    delete after.managerCareer;
    delete after.news;
    assert.deepEqual(after, baseline);
    return { command, result: result.body };
  };
  const invited = await send({ type: 'acceptManagerInvite' });
  assert.equal(invited.result.patch.managerCareer.status, 'unemployed');
  assert.equal(invited.result.patch.managerCareer.offers[0].status, 'interview');
  assert.equal(invited.result.patch.news[0].managerOfferId, id);
  const futureQuestion = await call(
    '/api/career',
    {
      type: 'managerInterview',
      id,
      question: 'staff',
      answer: 'keep',
      revision,
      responseMode: 'patch',
    },
    user,
  );
  assert.equal(futureQuestion.status, 400);
  assert.equal((await call('/api/career', invited.command, 'different-user')).status, 409);
  for (const [question, answer] of [
    ['motivation', 'project'],
    ['career', 'responsibility'],
    ['style', 'youth'],
    ['target', 'ambitious'],
    ['budget', 'lean'],
    ['staff', 'keep'],
  ]) {
    const response = await send({ type: 'managerInterview', question, answer });
    assert.equal(response.result.patch.managerCareer.offers[0].interview.at(-1).answerId, answer);
  }
  const stale = await call('/api/career', invited.command, user);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.reload, true);
  assert.equal((await raw()).managerCareer.offers[0].status, 'pending');
  const current = await raw();
  current.managerCareer.offers[0].status = 'offered';
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(current), user)
    .run();
  const terms = await send({ type: 'acceptManagerTerms', termsVersion: 1 });
  assert.equal(terms.result.patch.managerCareer.offers[0].contractTerms.status, 'agreed');
  assert.equal(terms.result.patch.managerCareer.status, 'unemployed');
  assert.equal(
    (
      await call(
        '/api/career',
        { type: 'acceptManagerTerms', id, termsVersion: 1, revision, responseMode: 'patch' },
        user,
      )
    ).status,
    400,
  );
  assert.deepEqual(await tables(), projected);
  const next = { type: 'declineManager', id, revision, responseMode: 'patch' };
  const race = await Promise.all([
    call('/api/career', { ...next, requestId: crypto.randomUUID() }, user),
    call('/api/career', { ...next, requestId: crypto.randomUUID() }, user),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  const contact = (await call('/api/career', undefined, user)).body.state.managerCareer;
  const declined = contact.offers.find((offer) => offer.id === id);
  assert.equal(declined.status, 'rejected');
  assert.ok(declined.closedAt);
  assert.equal(contact.approachHistory[declined.club].closedAt, declined.closedAt);
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM career_actions WHERE user_id=?')
    .bind(user)
    .first();
  assert.equal(count.n, revision + 1);
});

test('D1 inbox reads only update messages, isolate owners and preserve saves across retries and races', async () => {
  const user = 'bounded-inbox-qa';
  const started = await action(
    { type: 'start', club: 'kbo-lotte', manager: '수신함 검증', mode: 'short', preseason: false },
    user,
  );
  const raw = async () =>
    JSON.parse(
      (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
    );
  const original = await raw();
  original.news = [
    { id: 'one', title: '읽을 메일', body: '첫 번째', kind: 'club', read: false },
    {
      id: 'two',
      title: '보류할 메일',
      body: '두 번째',
      kind: 'club',
      read: false,
      choiceKind: 'promise',
    },
  ];
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(original), user)
    .run();
  const { news: originalNews, ...baseline } = original;
  const projections = async () =>
    Promise.all(
      [
        'career_players',
        'contracts',
        'career_staff',
        'career_standings',
        'negotiations',
        'finance_entries',
        'career_matches',
      ].map(
        async (table) =>
          (await db.prepare(`SELECT * FROM ${table} WHERE user_id=?`).bind(user).all()).results,
      ),
    );
  const before = await projections();
  const command = {
    type: 'readNews',
    id: 'one',
    revision: started.revision,
    requestId: crypto.randomUUID(),
    responseMode: 'patch',
  };
  const result = await call('/api/career', command, user);
  assert.equal(result.status, 201);
  assert.deepEqual(Object.keys(result.body.patch), ['news']);
  assert.equal(result.body.state, undefined);
  assert.equal(result.body.baseRevision, started.revision);
  assert.equal(result.body.revision, started.revision + 1);
  assert.deepEqual(result.body.patch.news, [{ ...originalNews[0], read: true }, originalNews[1]]);
  assert.deepEqual((await call('/api/career', command, user)).body, result.body);
  assert.equal((await call('/api/career', command, 'not-the-inbox-owner')).status, 409);
  const stale = await call('/api/career', { ...command, requestId: crypto.randomUUID() }, user);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.reload, true);
  const all = { type: 'readAllNews', revision: result.body.revision, responseMode: 'patch' };
  const race = await Promise.all([
    call('/api/career', { ...all, requestId: crypto.randomUUID() }, user),
    call('/api/career', { ...all, requestId: crypto.randomUUID() }, user),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await call('/api/career', command, user)).status, 409);
  const { news, ...after } = await raw();
  assert.deepEqual(after, baseline);
  assert.deepEqual(
    news,
    originalNews.map((n) => ({ ...n, read: true })),
  );
  assert.deepEqual(await projections(), before);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM career_actions WHERE user_id=?')
        .bind(user)
        .first()
    ).n,
    started.revision + 2,
  );
});

test('D1 player conversation patches the target mood and news atomically without changing the world', async () => {
  const user = 'bounded-player-conversation';
  const started = await action(
    { type: 'start', club: 'kbo-lotte', manager: '면담 검증', mode: 'short', preseason: false },
    user,
  );
  const raw = async () =>
    JSON.parse(
      (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
    );
  const initial = await raw(),
    player = initial.roster.find((p) => p.pos !== 'P');
  player.mood.recent = Array(12).fill(false);
  initial.news = [
    {
      id: 'playing-time',
      day: initial.day,
      title: '출전 요청',
      body: '기회를 주세요',
      kind: 'morale',
      choiceKind: 'playingTime',
      playerId: player.id,
    },
  ];
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(initial), user)
    .run();
  const command = {
    type: 'respondNews',
    id: 'playing-time',
    choice: 'promise',
    responseMode: 'patch',
    revision: started.revision,
    requestId: crypto.randomUUID(),
  };
  const result = await call('/api/career', command, user);
  assert.equal(result.status, 201, JSON.stringify(result));
  assert.equal(result.body.patch.playerMood.id, player.id);
  assert.deepEqual(result.body.patch.playerMood.mood.promise, {
    due: initial.day + 14,
    games: 4,
    startGames: player.stats.g,
  });
  assert.equal(result.body.patch.playerMood.mood.value, Math.min(100, player.mood.value + 6));
  assert.deepEqual((await call('/api/career', command, user)).body, result.body);
  assert.equal((await call('/api/career', command, 'someone-else')).status, 409);
  assert.equal(
    (await call('/api/career', { ...command, requestId: crypto.randomUUID() }, user)).status,
    409,
  );
  const after = await raw(),
    updated = after.roster.find((p) => p.id === player.id);
  assert.deepEqual(updated.mood, result.body.patch.playerMood.mood);
  const projection = JSON.parse(
    (
      await db
        .prepare('SELECT data FROM career_players WHERE user_id=? AND player_id=?')
        .bind(user, player.id)
        .first()
    ).data,
  );
  assert.deepEqual(projection.mood, updated.mood);
  updated.mood = player.mood;
  after.news = initial.news;
  assert.deepEqual(after, initial);
  // Concurrent different answers must have one winner and one revision conflict.
  const pending = await raw();
  pending.news.unshift({ ...initial.news[0], id: 'second-conversation' });
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(pending), user)
    .run();
  const race = await Promise.all(
    ['promise', 'explain'].map((choice) =>
      call(
        '/api/career',
        {
          ...command,
          id: 'second-conversation',
          choice,
          revision: result.body.revision,
          requestId: crypto.randomUUID(),
        },
        user,
      ),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
});

test('A date action saves all locally read IDs in the same revision and preserves failed requests', async () => {
  const user = 'deferred-reading-qa';
  const started = await action(
    {
      type: 'start',
      club: 'kbo-lotte',
      manager: '날짜와 읽음 저장',
      mode: 'full',
      preseason: false,
    },
    user,
  );
  const ids = started.state.news.slice(0, 2).map((n) => n.id);
  assert.equal(ids.length, 2);
  const command = {
    type: 'continueDay',
    simulateGames: true,
    readNewsIds: ids,
    revision: started.revision,
    requestId: crypto.randomUUID(),
  };
  const saved = await call('/api/career', command, user);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.revision, started.revision + 1);
  assert.equal(saved.body.state.day, started.state.day + 1);
  assert.ok(saved.body.state.news.filter((n) => ids.includes(n.id)).every((n) => n.read));
  assert.equal((await call('/api/career', command, user)).body.revision, saved.body.revision);
  const invalid = await call(
    '/api/career',
    { ...command, readNewsIds: [3], revision: saved.body.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(invalid.status, 400);
  const latest = await call('/api/career', undefined, user);
  assert.equal(latest.body.revision, saved.body.revision);
  assert.equal(latest.body.state.day, saved.body.state.day);
  assert.ok(latest.body.state.news.filter((n) => ids.includes(n.id)).every((n) => n.read));
});

test('Batch renewal persists all proposals once, preserves contracts and rejects stale or invalid batches without partial writes', async () => {
  const user = 'batch-renewals-qa';
  const started = await action(
    { type: 'start', club: 'kbo-kia', manager: '일괄 재계약', mode: 'short', preseason: false },
    user,
  );
  const players = started.state.roster.filter((p) => p.years === 1).slice(0, 3);
  assert.equal(players.length, 3);
  const command = {
    type: 'renewContracts',
    offers: players.map((p) => ({ id: p.id, salary: p.salary * 1.1, years: 3 })),
    revision: started.revision,
    requestId: crypto.randomUUID(),
  };
  const invalid = await call(
    '/api/career',
    { ...command, offers: [...command.offers, { ...command.offers[0], id: 'not-owned' }] },
    user,
  );
  assert.equal(invalid.status, 400);
  assert.equal((await call('/api/career', undefined, user)).body.revision, started.revision);
  const sent = await call('/api/career', command, user);
  assert.equal(sent.status, 201);
  assert.equal(sent.body.revision, started.revision + 1);
  assert.equal(sent.body.state.deals.length, 3);
  assert.ok(sent.body.state.deals.every((d) => d.status === 'pending' && d.type === 'renew'));
  assert.equal(sent.body.state.budget, started.state.budget);
  assert.deepEqual(sent.body.state.roster, started.state.roster);
  assert.deepEqual((await call('/api/career', undefined, user)).body, sent.body);
  const retry = await call('/api/career', command, user);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.revision, sent.body.revision);
  const repeated = await call(
    '/api/career',
    { ...command, requestId: crypto.randomUUID(), revision: sent.body.revision },
    user,
  );
  assert.equal(repeated.status, 400);
  assert.equal((await call('/api/career', undefined, user)).body.revision, sent.body.revision);
});

test('Legacy postseason calendars are repaired on read without writes and completed games persist with weather once', async () => {
  const user = 'postseason-weather-api';
  await action(
    {
      type: 'start',
      club: 'kbo-kiwoom',
      manager: 'Postseason API',
      mode: 'short',
      preseason: false,
    },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.day = raw.rounds;
  raw.phase = 'semifinal';
  raw.news = [];
  raw.series = [
    { a: raw.club, b: 'kbo-lg', aw: 0, bw: 0 },
    { a: 'kbo-kia', b: 'kbo-ssg', aw: 1, bw: 0 },
  ];
  delete raw.postseason;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const stored = await db
    .prepare('SELECT state,revision FROM careers WHERE user_id=?')
    .bind(user)
    .first();
  const read = await call('/api/career', undefined, user);
  assert.equal(read.status, 200);
  assert.equal(read.body.state.postseason.rounds[0].fixtures.length, 5);
  assert.equal(read.body.state.postseason.format, 'four-team');
  assert.deepEqual(
    await db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first(),
    stored,
  );
  const started = await action({ type: 'startMatch', matchCards: true }, user);
  assert.equal(started.state.liveMatch.weather.covered, true);
  assert.equal(started.state.liveMatch.weather.cancellation, undefined);
  const live = started.state.liveMatch;
  const payload = {
    type: 'delegateMatch',
    date: live.timeline.date,
    cursor: 0,
    timelineVersion: live.timelineVersion,
    playbackId: live.playbackId,
    revision: started.revision,
    requestId: crypto.randomUUID(),
  };
  const completed = await call('/api/career', payload, user);
  assert.equal(completed.status, 201, JSON.stringify(completed.body));
  const result = completed.body.state.history[0];
  assert.equal(result.post, true);
  assert.equal(result.weather.covered, true);
  assert.ok(result.fixtureId.startsWith('post-'));
  assert.deepEqual(completed.body.state.standings.kbo, raw.standings.kbo);
  const fixture = completed.body.state.postseason.rounds[0].fixtures.find(
    (f) => f.id === result.fixtureId,
  );
  assert.equal(fixture.status, 'completed');
  assert.deepEqual(fixture.score, { home: result.homeScore, away: result.awayScore });
  const again = await call('/api/career', payload, user);
  assert.equal(again.status, 201);
  assert.equal(again.body.revision, completed.body.revision);
  assert.equal(again.body.state.history.length, 1);
  const restored = await call('/api/career', undefined, user);
  assert.deepEqual(restored.body.state.postseason, completed.body.state.postseason);
  const catalog = await call('/api/catalog', undefined, user);
  assert.equal(catalog.body.clubs.filter((c) => c.ballpark?.roof === 'covered').length, 15);
});

for (const [reason, seed] of [
  ['rain', 40],
  ['ground', 3],
])
  test(`${reason} cancellation rejects match preparation without writes and persists rescheduling once`, async () => {
    const user = `weather-cancel-${reason}`;
    const initial = await action(
      { type: 'start', club: 'kbo-lotte', manager: 'Weather API', mode: 'short', preseason: false },
      user,
    );
    // Fixed conditions at Lotte's generated 2026-03-28 home opener.
    await db
      .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',?) WHERE user_id=?")
      .bind(seed, user)
      .run();
    const before = await db
      .prepare('SELECT state,revision FROM careers WHERE user_id=?')
      .bind(user)
      .first();
    const rejected = await call(
      '/api/career',
      { type: 'startMatch', revision: initial.revision, requestId: crypto.randomUUID() },
      user,
    );
    assert.equal(rejected.status, 400);
    assert.deepEqual(
      await db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first(),
      before,
    );
    const command = {
      type: 'advance',
      count: 1,
      revision: initial.revision,
      requestId: crypto.randomUUID(),
    };
    const progressed = await call('/api/career', command, user);
    assert.equal(progressed.status, 201, JSON.stringify(progressed.body));
    const state = progressed.body.state;
    assert.equal(state.day, initial.state.day + 1);
    assert.equal(state.history.length, 0);
    assert.deepEqual(
      state.standings.kbo.find((s) => s.club === state.club),
      initial.state.standings.kbo.find((s) => s.club === state.club),
    );
    assert.deepEqual(
      state.roster.map((p) => p.stats),
      initial.state.roster.map((p) => p.stats),
    );
    const own = Object.values(state.weather.postponed).filter((e) =>
      [e.fixture.home, e.fixture.away].includes(state.club),
    );
    assert.equal(own.length, 1);
    assert.equal(own[0].cancellations.length, 1);
    assert.equal(own[0].cancellations[0].reason, reason);
    assert.equal(own[0].cancellations[0].date, '2026-03-28');
    assert.equal(own[0].fixture.date, '2026-03-30');
    assert.ok(state.news.some((n) => n.actionView === 'schedule' && n.title.includes('취소')));
    const repeated = await call('/api/career', command, user);
    assert.equal(repeated.body.revision, progressed.body.revision);
    assert.deepEqual(repeated.body.state.weather, state.weather);
    assert.deepEqual(
      (await call('/api/career', undefined, user)).body.state.weather,
      state.weather,
    );
  });

test('An unplayed KBO save repairs to five seeds without a write and the first seed waits for the Korean Series', async () => {
  const user = 'kbo-bye-migration';
  await action(
    { type: 'start', club: 'kbo-kia', manager: 'Bye API', mode: 'short', preseason: false },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  const seeds = ['kbo-kia', 'kbo-lg', 'kbo-ssg', 'kbo-doosan', 'kbo-lotte'];
  raw.phase = 'semifinal';
  raw.day = raw.rounds;
  raw.news = [];
  raw.series = [
    { a: seeds[0], b: seeds[3], aw: 0, bw: 0 },
    { a: seeds[1], b: seeds[2], aw: 0, bw: 0 },
  ];
  seeds.forEach((club, i) =>
    Object.assign(
      raw.standings.kbo.find((s) => s.club === club),
      { w: 100 - i * 5, l: 40 + i * 5 },
    ),
  );
  delete raw.postseason;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const before = await db
    .prepare('SELECT state,revision FROM careers WHERE user_id=?')
    .bind(user)
    .first();
  const read = await call('/api/career', undefined, user);
  assert.equal(read.body.state.phase, 'wildcard');
  assert.equal(read.body.state.postseason.format, 'kbo');
  assert.deepEqual(read.body.state.postseason.seeds, seeds);
  assert.deepEqual(
    await db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first(),
    before,
  );
  const rejected = await call(
    '/api/career',
    { type: 'startMatch', revision: read.body.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(rejected.status, 400);
  assert.deepEqual(
    await db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first(),
    before,
  );
  const progressed = await action({ type: 'continue' }, user);
  assert.equal(progressed.state.postseason.format, 'kbo');
  assert.equal(progressed.state.history.length, 0);
  assert.deepEqual(progressed.state.standings.kbo, raw.standings.kbo);
  assert.deepEqual(
    (await call('/api/career', undefined, user)).body.state.postseason,
    progressed.state.postseason,
  );
});

test('A finished-season manager counterproposal receives a persisted reply once, signs and unlocks the next season', async () => {
  const user = 'manager-renewal-reply';
  await action(
    { type: 'start', club: 'kbo-kia', manager: 'Renewal API', mode: 'short', preseason: false },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.phase = 'finished';
  raw.day = raw.rounds;
  raw.news = [];
  raw.champion = raw.club;
  const c = raw.managerCareer.contract;
  c.throughYear = raw.year;
  c.reviewedYear = raw.year;
  c.targetRank = 1;
  raw.standings.kbo.find((s) => s.club === raw.club).w = 100;
  const date = new Date(Date.UTC(raw.year, 2, 28) + raw.day * 86400000).toISOString().slice(0, 10);
  const expires = new Date(Date.parse(date) + 14 * 86400000).toISOString().slice(0, 10);
  const offer = {
    id: 'api-renewal',
    club: raw.club,
    source: 'renewal',
    salary: c.salary * 1.15,
    targetRank: 1,
    applied: date,
    due: date,
    expires,
    status: 'offered',
    message: 'Renewal',
  };
  raw.managerCareer.offers = [offer];
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const terms = { version: 1 };
  const proposed = await action(
    {
      type: 'negotiateManagerContract',
      id: offer.id,
      termsVersion: terms.version,
      salary: offer.salary * 1.05,
      signingBonus: 0,
      years: 1,
      targetRank: 1,
    },
    user,
  );
  assert.equal(proposed.state.managerCareer.offers[0].contractTerms.status, 'pending');
  const blocked = await call(
    '/api/career',
    { type: 'nextSeason', revision: proposed.revision, requestId: crypto.randomUUID() },
    user,
  );
  assert.equal(blocked.status, 400);
  const command = {
    type: 'managerContinue',
    count: 1,
    revision: proposed.revision,
    requestId: crypto.randomUUID(),
  };
  const reply = await call('/api/career', command, user);
  assert.equal(reply.status, 201);
  assert.equal(reply.body.state.day, raw.day + 1);
  const agreed = reply.body.state.managerCareer.offers[0];
  assert.equal(agreed.contractTerms.status, 'agreed');
  assert.equal(reply.body.state.phase, 'finished');
  assert.deepEqual((await call('/api/career', command, user)).body, reply.body);
  assert.deepEqual((await call('/api/career', undefined, user)).body, reply.body);
  const signed = await action(
    {
      type: 'signManager',
      id: offer.id,
      termsVersion: agreed.contractTerms.version,
      signature: raw.manager,
    },
    user,
  );
  assert.ok(
    !signed.state.managerCareer.offers.some((o) => o.id === offer.id && o.status === 'offered'),
  );
  assert.equal(signed.state.managerCareer.contract.salary, agreed.contractTerms.salary);
  const next = await action({ type: 'nextSeason' }, user);
  assert.equal(next.state.year, raw.year + 1);
  assert.ok(next.state.managerCareer.contract.throughYear >= next.state.year);
});

async function slotAction(payload, user, slot = 'challenge') {
  const headers = { 'x-career-slot': slot };
  const current = await call('/api/career', undefined, user, headers);
  const command = { ...payload, revision: current.body.revision, requestId: crypto.randomUUID() };
  const result = await call('/api/career', command, user, headers);
  assert.equal(result.status, 201, JSON.stringify(result.body).slice(0, 500));
  return { ...result.body, command };
}

test('Trade recommendations read the current owner save without writes and repeated counteroffers persist one negotiation', async () => {
  const user = 'trade-recommendation-owner';
  await action({ type: 'start', club: 'kbo-lotte', manager: '교환안 감독', mode: 'short' }, user);
  const before = await db
    .prepare('SELECT state,revision FROM careers WHERE user_id=?')
    .bind(user)
    .first();
  const recommended = await call('/api/career/trades/recommendations', {}, user);
  assert.equal(recommended.status, 201, JSON.stringify(recommended.body));
  assert.ok(recommended.body.suggestions.length);
  assert.deepEqual(
    await db.prepare('SELECT state,revision FROM careers WHERE user_id=?').bind(user).first(),
    before,
  );
  assert.ok(!JSON.stringify(recommended.body).includes('potential'));
  const s = recommended.body.suggestions[0];
  let proposed = await action(
    {
      type: 'proposeTrade',
      club: s.club,
      incoming: s.incoming.map((p) => p.id),
      outgoing: s.outgoing.map((p) => p.id),
      cash: s.cash - 1000,
    },
    user,
  );
  const id = proposed.state.trades[0].id;
  proposed = await action(
    {
      type: 'reviseTrade',
      id,
      incoming: s.incoming.map((p) => p.id),
      outgoing: s.outgoing.map((p) => p.id),
      cash: s.cash - 1000,
    },
    user,
  );
  const o = proposed.state.trades[0];
  assert.equal(o.status, 'counter');
  assert.equal(o.round, 2);
  const quote = await call(
    '/api/career/trades/recommendations',
    { offerId: id, club: o.club, incoming: o.incoming },
    user,
  );
  assert.equal(quote.status, 201);
  assert.ok(quote.body.suggestions.length);
  assert.equal(
    (
      await call(
        '/api/career/trades/recommendations',
        { offerId: id },
        'foreign-recommendation-owner',
      )
    ).status,
    400,
  );
  const payload = {
    type: 'reviseTrade',
    id,
    incoming: o.counterIncoming || o.incoming,
    outgoing: o.counterOutgoing || o.outgoing,
    cash: o.counterCash,
    revision: proposed.revision,
    requestId: crypto.randomUUID(),
  };
  const revised = await call('/api/career', payload, user);
  assert.equal(revised.status, 201, JSON.stringify(revised.body));
  assert.equal(revised.body.state.trades.length, 1);
  assert.equal(revised.body.state.trades[0].round, 3);
  assert.equal(revised.body.state.trades[0].status, 'accepted');
  assert.equal(revised.body.state.budget, proposed.state.budget);
  assert.deepEqual(revised.body.state.roster, proposed.state.roster);
  assert.deepEqual((await call('/api/career', payload, user)).body, revised.body);
  const restored = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(restored.state.trades[0].history, revised.body.state.trades[0].history);
  const finished = await action({ type: 'acceptTrade', id }, user);
  assert.equal(finished.state.trades[0].status, 'completed');
});

test('Deadline bids persist one rival offer, reject other owners and complete one real player exchange after confirmation', async () => {
  const user = 'deadline-bid-owner';
  await action(
    { type: 'start', club: 'kbo-lotte', manager: '마감 경쟁', mode: 'short', preseason: false },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.day = Math.floor(raw.rounds * 0.8) - 7;
  raw.news = [];
  raw.weather.seed = 0;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const opened = await action({ type: 'careerReportMode', mode: 'important' }, user),
    listing = opened.state.deadlineMarket.listings[0];
  assert.ok(listing);
  const repeat = await action({ type: 'careerReportMode', mode: 'important' }, user);
  assert.deepEqual(repeat.state.deadlineMarket, opened.state.deadlineMarket);
  const chosen = repeat.state.roster
    .filter((p) => p.pos === listing.player.pos)
    .sort(
      (a, b) =>
        b.contact + b.power + b.stuff + b.control - (a.contact + a.power + a.stuff + a.control),
    )[0];
  const payload = {
    type: 'proposeTrade',
    deadlineId: listing.id,
    club: listing.seller,
    incoming: [listing.player.id],
    outgoing: [chosen.id],
    cash: 1000,
    revision: repeat.revision,
    requestId: crypto.randomUUID(),
  };
  const bid = await call('/api/career', payload, user);
  assert.equal(bid.status, 201, JSON.stringify(bid.body));
  const offer = bid.body.state.trades[0];
  assert.equal(offer.deadline.id, listing.id);
  assert.ok(offer.deadline.leading);
  assert.deepEqual(bid.body.state.roster, repeat.state.roster);
  assert.equal(bid.body.state.budget, repeat.state.budget);
  assert.deepEqual((await call('/api/career', payload, user)).body, bid.body);
  assert.equal((await call('/api/career', payload, 'deadline-foreign-owner')).status, 409);
  const restored = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(restored.state.trades[0].deadline, offer.deadline);
  const accept = {
    type: 'acceptTrade',
    id: offer.id,
    revision: restored.revision,
    requestId: crypto.randomUUID(),
  };
  const signed = await call('/api/career', accept, user);
  assert.equal(signed.status, 201, JSON.stringify(signed.body));
  assert.equal(signed.body.state.deadlineMarket.listings[0].status, 'won');
  assert.ok(signed.body.state.roster.some((p) => p.id === listing.player.id));
  const duplicate = await call('/api/career', accept, user);
  assert.deepEqual(duplicate.body, signed.body);
  const stored = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  assert.equal(stored.ownership[listing.player.id], raw.club);
  assert.equal(stored.ownership[chosen.id], listing.seller);
  assert.equal(stored.deadlineMarket.listings[0].status, 'won');
});

test('Remodel and club memories persist in the owner career and reject forged results and duplicate seasonal projects', async () => {
  const user = 'remodel-memory-owner';
  const started = await action(
    { type: 'start', club: 'kbo-lotte', manager: '육성 기록', mode: 'short', preseason: false },
    user,
  );
  const row = await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first(),
    raw = JSON.parse(row.state),
    p = raw.roster.find((p) => p.pos !== 'P');
  p.power = 60;
  p.contact = 65;
  p.potential = 90;
  raw.history = [
    {
      id: 'persisted-memory',
      home: raw.club,
      away: 'kbo-kia',
      homeScore: 4,
      awayScore: 3,
      mvp: p.name,
      day: 0,
      date: '2026-03-28',
      hits: [8, 9],
      errors: [0, 0],
      innings: [[0], [0]],
      log: [],
    },
  ];
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const begun = await action({ type: 'startRemodel', id: p.id, kind: 'slugger' }, user);
  assert.equal(begun.state.roster.find((v) => v.id === p.id).remodel.status, 'training');
  const saved = await action(
    { type: 'pinClubMoment', id: 'persisted-memory', caption: '우리의 첫 승', homeScore: 90 },
    user,
  );
  assert.equal(saved.state.clubLegacy.moments[0].homeScore, 4);
  assert.equal(
    (
      await call(
        '/api/career',
        { type: 'pinClubMoment', id: 'fake', revision: saved.revision },
        user,
      )
    ).status,
    400,
  );
  const restored = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(restored.state.clubLegacy, saved.state.clubLegacy);
  assert.equal(restored.state.roster.find((v) => v.id === p.id).remodel.kind, 'slugger');
  const cancelled = await action({ type: 'cancelRemodel', id: p.id }, user);
  assert.equal(
    (
      await call(
        '/api/career',
        { type: 'startRemodel', id: p.id, kind: 'contact', revision: cancelled.revision },
        user,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        '/api/career',
        { type: 'cancelRemodel', id: p.id, revision: cancelled.revision },
        'foreign-remodel-owner',
      )
    ).status,
    409,
  );
  assert.equal(started.state.budget, cancelled.state.budget);
});

test('Tactical plans persist atomically, freeze at kickoff and survive bounded command patches without exposing prepared inputs', async () => {
  const user = 'tactical-plan-owner';
  await action(
    { type: 'start', club: 'kbo-lotte', manager: '전술 검증', mode: 'short', preseason: false },
    user,
  );
  await db
    .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',0) WHERE user_id=?")
    .bind(user)
    .run();
  const initial = await action({ type: 'startMatch' }, user);
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  const { home, away } = raw.liveMatch;
  delete raw.liveMatch;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const key = `${raw.year}:${raw.day}:${home}:${away}:${raw.history.filter((r) => r.day === raw.day && (r.date?.startsWith(String(raw.year)) ?? true)).length}`;
  const payload = {
    type: 'setDefensivePlan',
    key,
    plan: 'guardPower',
    revision: initial.revision,
    requestId: crypto.randomUUID(),
  };
  const response = await call('/api/career', payload, user);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.state.engagement.tactics.selection.plan, 'guardPower');
  assert.deepEqual((await call('/api/career', payload, user)).body, response.body);
  assert.equal(
    (await call('/api/career', { ...payload, requestId: crypto.randomUUID() }, user)).status,
    409,
  );
  assert.equal((await call('/api/career', payload, 'foreign-tactical-owner')).status, 409);
  const saved = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(saved.state.engagement.tactics, response.body.state.engagement.tactics);
  assert.equal(saved.state.day, raw.day);
  const started = await action({ type: 'startMatch' }, user),
    live = started.state.liveMatch;
  assert.equal((live.home === raw.club ? live.duel.home : live.duel.away).plan, 'guardPower');
  const own = live.home === raw.club ? 1 : 0,
    cursor = live.timeline.log.findIndex(
      (event, i) =>
        i > 0 &&
        event.half === own &&
        event.play?.plateAppearance !== false &&
        event.play?.before.outs < 3,
    );
  const changed = await action(
    {
      type: 'matchCommand',
      command: 'swingAway',
      cursor,
      timelineVersion: live.timelineVersion,
      responseMode: 'patch',
    },
    user,
  );
  assert.deepEqual(changed.patch.liveMatch.duel, live.duel);
  assert.deepEqual(
    changed.patch.liveMatch.timeline.log.slice(0, cursor),
    live.timeline.log.slice(0, cursor),
  );
  assert.equal(changed.patch.liveMatch.prepared, undefined);
  const final = await action(
    {
      type: 'completeMatch',
      cursor: changed.patch.liveMatch.timeline.log.length,
      timelineVersion: changed.patch.liveMatch.timelineVersion,
    },
    user,
  );
  assert.equal(final.state.engagement.tactics.observations.length, 2);
  assert.deepEqual(final.state.history[0].duel, live.duel);
  assert.ok(
    final.state.news.some((n) => n.report?.sections?.some((s) => s.title === '벤치 수싸움')),
  );
});

test('Competition decisions persist both player reactions once and cannot be bypassed through the single-player inbox endpoint', async () => {
  const user = 'competition-owner';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: '경쟁 검증', mode: 'short', preseason: false },
    user,
  );
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.news = [];
  raw.weather.seed = 0;
  const [prospect, veteran] = raw.roster.filter((p) => p.pos !== 'P').slice(0, 2);
  for (const p of [prospect, veteran]) {
    p.mood.value = 60;
    p.mood.role = 'regular';
    p.condition = 100;
    delete p.injury;
    delete p.internationalDuty;
  }
  const participant = (p) => ({ id: p.id, name: p.name, starts: 0, ab: 0, h: 0, hr: 0 });
  const c = {
    id: 'api-competition',
    club: raw.club,
    created: raw.calendar?.currentDate || '2026-03-28',
    status: 'decision',
    veteran: participant(veteran),
    prospect: participant(prospect),
    evidence: '출전 기록에 따른 테스트 사례',
    games: 0,
    observed: [],
  };
  raw.engagement.competitions = [c];
  raw.news = [
    {
      id: 'api-competition-news',
      day: raw.day,
      kind: 'morale',
      title: '방침 요청',
      body: c.evidence,
      playerId: veteran.id,
      competitionId: c.id,
      choiceKind: 'lineupCompetition',
    },
  ];
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  const bad = await call(
    '/api/career',
    {
      type: 'respondNews',
      id: raw.news[0].id,
      choice: 'promise',
      revision: initial.revision,
      requestId: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(bad.status, 400);
  const read = await action({ type: 'readNews', id: raw.news[0].id }, user);
  const loaded = (await call('/api/career', undefined, user)).body;
  assert.equal(loaded.state.engagement.competitions[0].status, 'decision');
  const payload = {
    type: 'respondCompetition',
    id: c.id,
    choice: 'backProspect',
    revision: read.revision,
    requestId: crypto.randomUUID(),
  };
  const chosen = await call('/api/career', payload, user);
  assert.equal(chosen.status, 201, JSON.stringify(chosen.body));
  const state = chosen.body.state;
  assert.equal(state.engagement.competitions[0].status, 'trial');
  assert.equal(state.roster.find((p) => p.id === veteran.id).mood.value, 57);
  assert.equal(state.roster.find((p) => p.id === veteran.id).mood.role, 'rotation');
  assert.equal(state.roster.find((p) => p.id === prospect.id).mood.value, 62);
  assert.equal(state.news.find((n) => n.id === raw.news[0].id).choice, 'backProspect');
  assert.deepEqual((await call('/api/career', payload, user)).body, chosen.body);
  assert.equal((await call('/api/career', payload, 'competition-other-owner')).status, 409);
  assert.equal(
    (await call('/api/career', { ...payload, requestId: crypto.randomUUID() }, user)).status,
    409,
  );
  const live = await action({ type: 'startMatch' }, user);
  const finished = await action(
    {
      type: 'completeMatch',
      cursor: live.state.liveMatch.timeline.log.length,
      timelineVersion: live.state.liveMatch.timelineVersion,
    },
    user,
  );
  assert.equal(finished.state.engagement.competitions[0].games, 1);
  const reloaded = (await call('/api/career', undefined, user)).body.state;
  assert.deepEqual(reloaded.engagement.competitions, finished.state.engagement.competitions);
});

test('Challenge storage preserves the primary live match, isolates archives and deduplicates within its authenticated slot', async () => {
  const user = 'challenge-isolation';
  await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Original', mode: 'short', preseason: false },
    user,
  );
  await db
    .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',0) WHERE user_id=?")
    .bind(user)
    .run();
  await action({ type: 'startMatch' }, user);
  const original = await db.prepare('SELECT * FROM careers WHERE user_id=?').bind(user).first();
  const headers = { 'x-career-slot': 'challenge' };
  assert.equal((await call('/api/career', undefined, user, headers)).body.state, null);
  const started = await slotAction(
    { type: 'start', club: 'kbo-kia', manager: 'Challenge', mode: 'short', challenge: 'chase' },
    user,
  );
  assert.equal(started.state.challenge.kind, 'chase');
  assert.equal(started.state.history.length, 0);
  assert.deepEqual(
    (await call('/api/career', started.command, user, headers)).body.state,
    started.state,
  );
  const owner =
    'challenge/' +
    (await import('node:crypto'))
      .createHash('sha256')
      .update('dugout:challenge:' + user)
      .digest('hex');
  await db
    .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',0) WHERE user_id=?")
    .bind(owner)
    .run();
  let live = await slotAction({ type: 'startMatch', matchCards: true }, user);
  const draft = live.state.liveMatch.cards;
  live = await slotAction(
    {
      type: 'chooseMatchCards',
      draftId: draft.id,
      ids: draft.offered.slice(0, 3).map((c) => c.id),
      cursor: 0,
      timelineVersion: live.state.liveMatch.timelineVersion,
    },
    user,
  );
  const completed = await slotAction(
    {
      type: 'completeMatch',
      cursor: live.state.liveMatch.timeline.log.length,
      timelineVersion: live.state.liveMatch.timelineVersion,
    },
    user,
  );
  assert.equal(completed.state.challenge.played, 1);
  assert.equal(
    (await call('/api/career', completed.command, user, headers)).body.state.challenge.played,
    1,
  );
  const id = completed.state.history[0].id;
  assert.equal((await call('/api/career/matches/' + id, undefined, user, headers)).status, 200);
  assert.equal((await call('/api/career/matches/' + id, undefined, user)).status, 404);
  assert.equal(
    (await call('/api/career/matches/' + id, undefined, 'another-owner', headers)).status,
    404,
  );
  assert.equal((await call('/api/career', undefined, 'another-owner', headers)).body.state, null);
  assert.deepEqual(
    await db.prepare('SELECT * FROM careers WHERE user_id=?').bind(user).first(),
    original,
  );
  const reload = await call('/api/career', undefined, user, headers);
  assert.equal(reload.body.state.challenge.played, 1);
  assert.equal(
    (await call('/api/career', undefined, user, { 'x-career-slot': 'invalid' })).status,
    400,
  );
  assert.equal(
    (
      await call(
        '/api/career',
        { ...started.command, replace: true, revision: 0, requestId: crypto.randomUUID() },
        'main-challenge-forgery',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        '/api/career',
        {
          type: 'start',
          club: 'kbo-kia',
          manager: 'Bad',
          mode: 'short',
          revision: 0,
          requestId: crypto.randomUUID(),
        },
        'challenge-main-forgery',
        headers,
      )
    ).status,
    400,
  );
  const forged = await call('/api/career', undefined, 'another-owner', {
    'x-dugout-user-id': owner,
    'x-dugout-career-slot': 'challenge',
  });
  assert.equal(forged.body.state, null);
});

test('Saved series commands and prospect milestones survive retry and reload without advancing a second game', async () => {
  const user = 'saved-series-prospect';
  const initial = await action(
    { type: 'start', club: 'kbo-lotte', manager: 'Prospect', mode: 'short', preseason: false },
    user,
  );
  const id = initial.state.lineup[0];
  const raw = JSON.parse(
    (await db.prepare('SELECT state FROM careers WHERE user_id=?').bind(user).first()).state,
  );
  raw.news = [];
  raw.weather.seed = 0;
  raw.roster.find((p) => p.id === id).age = 21;
  await db
    .prepare('UPDATE careers SET state=? WHERE user_id=?')
    .bind(JSON.stringify(raw), user)
    .run();
  await action({ type: 'followProspect', id, goal: 'starts' }, user);
  await action({ type: 'beginSeriesDelegation' }, user);
  const result = await slotAction({ type: 'delegateSeriesDay' }, user, 'main');
  assert.equal(result.state.engagement.seriesRun.played, 1);
  assert.equal(result.state.engagement.prospects[0].starts, 1);
  const duplicate = await call('/api/career', result.command, user);
  assert.equal(duplicate.status, 201);
  assert.deepEqual(duplicate.body.state.engagement, result.state.engagement);
  const reloaded = (await call('/api/career', undefined, user)).body;
  assert.deepEqual(reloaded.state.engagement, result.state.engagement);
  assert.equal(reloaded.state.history.length, 1);
  assert.ok(reloaded.state.history[0].matchCards);
  const stopped = await action({ type: 'stopSeriesDelegation' }, user);
  assert.equal(stopped.state.engagement.seriesRun.status, 'interrupted');
  assert.equal(stopped.state.history.length, 1);
  assert.equal(stopped.state.media.pending, undefined);
});

test('One-inning coaching persists a bounded live patch, returns control and deduplicates the request without advancing the date', async () => {
  const user = 'inning-delegation-owner';
  await action(
    { type: 'start', club: 'kbo-lotte', manager: '이닝 지휘', mode: 'short', preseason: false },
    user,
  );
  await db
    .prepare("UPDATE careers SET state=json_set(state,'$.weather.seed',0) WHERE user_id=?")
    .bind(user)
    .run();
  const started = await action({ type: 'startMatch' }, user),
    live = started.state.liveMatch;
  const payload = {
    type: 'delegateInning',
    date: live.timeline.date,
    cursor: 2,
    timelineVersion: live.timelineVersion,
    playbackId: live.playbackId,
    responseMode: 'patch',
    revision: started.revision,
    requestId: crypto.randomUUID(),
  };
  const result = await call('/api/career', payload, user);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.deepEqual(Object.keys(result.body.patch), ['liveMatch']);
  const next = result.body.patch.liveMatch;
  assert.equal(next.timeline.log[next.cursor].inning, 2);
  assert.equal(next.inningDelegations[0].inning, 1);
  assert.equal(next.prepared, undefined);
  assert.equal(next.opponents, undefined);
  assert.deepEqual(next.timeline.log.slice(0, 2), live.timeline.log.slice(0, 2));
  assert.deepEqual((await call('/api/career', payload, user)).body, result.body);
  assert.equal(
    (await call('/api/career', { ...payload, requestId: crypto.randomUUID() }, user)).status,
    409,
  );
  assert.equal((await call('/api/career', payload, 'foreign-inning-owner')).status, 409);
  const restored = (await call('/api/career', undefined, user)).body;
  assert.equal(restored.state.day, started.state.day);
  assert.equal(restored.state.history.length, started.state.history.length);
  assert.deepEqual(restored.state.liveMatch.inningDelegations, next.inningDelegations);
});
