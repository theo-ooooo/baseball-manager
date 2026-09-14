import { waitForReply } from './helpers/recruitment.mjs';
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-engine-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const require = createRequire(import.meta.url);
const {
  engine: e,
  world: { clubs, leagues, players: catalogPlayers, coaches: catalogCoaches },
} = require(out);
test('Renewals preserve performance accumulated since the offer, and catalog templates stay unchanged', () => {
  let g = e.newGame('mlb-dodgers', 'Test', 'short', 19);
  while (g.phase === 'preseason') g = e.advance(g, 7);
  const player = g.roster.find((p) => p.id === g.lineup[0]);
  g = e.negotiate(g, player.id, player.salary * 2, 3, 'renew');
  const id = g.deals[0].id;
  // Simulate the save/load boundary before another match is played.
  g = structuredClone(g);
  g = e.advance(g, 1);
  g = waitForReply(e, g, id);
  const current = g.roster.find((p) => p.id === player.id);
  const stats = structuredClone(current.stats),
    condition = current.condition;
  assert.ok(stats.ab > 0);
  g = e.signDeal(g, id);
  const renewed = g.roster.find((p) => p.id === player.id);
  assert.deepEqual(renewed.stats, stats);
  assert.equal(renewed.condition, condition);
  assert.equal(
    e.newGame('mlb-dodgers', 'Other', 'short', 19).roster.find((p) => p.id === player.id).stats.ab,
    0,
  );
});
test('World standings include exactly the fixtures elapsed on the calendar', () => {
  let g = e.newGame('kbo-lg', 'Test', 'short', 51);
  while (['preseason', 'regular'].includes(g.phase)) g = e.advance(g, 7);
  for (const l of leagues) {
    const until = new Date(Date.parse(g.calendar.openingDate + 'T12:00:00Z') + g.day * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const row of g.standings[l.id])
      assert.equal(
        row.w + row.l + row.d,
        e
          .fixtures(g, l.id)
          .filter((f) => f.date < until && (f.home === row.club || f.away === row.club)).length,
        l.id + ':' + row.club,
      );
  }
});
test('All playable clubs have legal, unique lineups and a starting pitcher', () => {
  for (const club of clubs) {
    const g = e.newGame(club.id, 'Test', 'short', 42);
    assert.equal(new Set(g.roster.map((p) => p.id)).size, g.roster.length, club.id);
    assert.equal(new Set(g.lineup).size, 9, club.id);
    assert.ok(g.roster.find((p) => p.id === g.starter && p.pos === 'P'));
    e.applyAction(g, { type: 'lineup', ids: g.lineup });
    for (const p of g.roster) assert.ok(Number.isFinite(e.overall(p)) && p.salary > 0);
  }
});
test('Round robin including odd leagues gives every pair home and away with no duplicate fixture', () => {
  for (const l of leagues) {
    const cs = clubs.filter((c) => c.league === l.id);
    const rounds = (cs.length % 2 ? cs.length : cs.length - 1) * 2,
      seen = new Set();
    for (let day = 0; day < rounds; day++) {
      const used = new Set();
      for (const [h, a] of e.pairings(l.id, day)) {
        assert.ok(!used.has(h) && !used.has(a));
        used.add(h);
        used.add(a);
        assert.ok(!seen.has(h + ':' + a), l.id);
        seen.add(h + ':' + a);
      }
    }
    assert.equal(seen.size, cs.length * (cs.length - 1), l.id);
  }
});
test('Match scoring, stats, world standings and next season remain consistent', () => {
  let g = e.newGame('kbo-lg', 'Test', 'short', 129);
  let safe = 0;
  // Tactical outcomes can lengthen the postseason and introduce additional player decisions.
  // Bound the whole season without assuming the former seed's number of advance calls.
  while (g.phase !== 'finished' && safe++ < 20) g = e.advance(g, 7);
  assert.equal(g.phase, 'finished');
  assert.ok(g.champion);
  assert.equal(g.past.length, 1);
  for (const rows of Object.values(g.standings)) {
    assert.equal(
      rows.reduce((s, r) => s + r.w, 0),
      rows.reduce((s, r) => s + r.l, 0),
    );
    assert.equal(
      rows.reduce((s, r) => s + r.rf, 0),
      rows.reduce((s, r) => s + r.ra, 0),
    );
  }
  for (const r of g.history) {
    assert.equal(
      r.awayScore,
      r.innings[0].reduce((s, n) => s + (n || 0), 0),
    );
    assert.equal(
      r.homeScore,
      r.innings[1].reduce((s, n) => s + (n || 0), 0),
    );
    assert.ok(r.innings[0].length >= 9);
    assert.equal(r.log.at(-1).score[0], r.awayScore);
    assert.equal(r.log.at(-1).score[1], r.homeScore);
  }
  for (const p of g.roster) {
    assert.ok(p.stats.h <= p.stats.ab);
    assert.ok(p.stats.hr <= p.stats.h);
    assert.ok(p.condition <= 100 && p.condition >= 0);
  }
  g = e.acceptRenewal(g);
  g = e.nextSeason(g);
  assert.equal(g.year, 2027);
  assert.equal(g.day, -28);
  assert.equal(g.phase, 'preseason');
  assert.equal(g.lineup.length, 9);
  assert.ok(g.roster.some((p) => !p.real && p.id.includes('2027')));
  // A changed match outcome may miss the board target; next season also supports unemployment.
  if (g.managerCareer?.status === 'unemployed')
    assert.throws(() => e.applyAction(g, { type: 'lineup', ids: g.lineup }), /무직/);
  else e.applyAction(g, { type: 'lineup', ids: g.lineup });
});
test('Agent negotiation, signing, resale and coach hiring update actual resources', () => {
  let g = e.newGame('mlb-dodgers', 'Test', 'short', 9);
  const p = e.marketPlayers(g).find((p) => p.club === 'fa');
  const submittedBudget = g.budget;
  g = e.negotiate(g, p.id, e.faDemand(g, p), 3);
  assert.equal(g.budget, submittedBudget);
  assert.equal(g.deals[0].status, 'pending');
  assert.throws(() => e.signDeal(g, g.deals[0].id), /기다려/);
  g = waitForReply(e, g, g.deals[0].id);
  const before = g.budget;
  assert.notEqual(g.deals[0].status, 'rejected');
  const d = g.deals[0];
  g = e.signDeal(g, d.id);
  assert.ok(g.roster.some((x) => x.id === p.id));
  assert.equal(g.budget, before - d.fee - d.agentFee - d.salary * 0.05);
  assert.throws(() => e.signDeal(g, d.id));
  assert.throws(() => e.sellPlayer(g, p.id), /제안/);
  g = e.applyAction(g, { type: 'listPlayer', id: p.id });
  g = e.advance(g, 3);
  const sale = g.saleOffers.find((o) => o.playerId === p.id);
  assert.ok(sale);
  g = e.sellPlayer(g, p.id, sale.id);
  assert.ok(!g.roster.some((x) => x.id === p.id));
  assert.ok(e.marketPlayers(g).some((x) => x.id === p.id));
  const coach = e.coachPool(g.year).find((c) => c.role === '투수' && c.skill > 85);
  const previousStaff = structuredClone(g.staff);
  g = e.applyAction(g, { type: 'coachOffer', id: coach.id, salary: coach.salary * 2, years: 3 });
  assert.deepEqual(g.staff, previousStaff);
  g = waitForReply(e, g, g.coachDeals[0].id, true);
  g = e.applyAction(g, { type: 'signCoach', id: g.coachDeals[0].id });
  assert.equal(e.coachSkill(g, '투수'), coach.skill);
  assert.equal(g.staff.length, 5);
  assert.throws(() => e.negotiate(g, p.id, -100, 3));
  assert.throws(() => e.negotiate(g, p.id, 20, 99));
});

test('Preseason plays four friendlies, develops reserves and stops exactly at opening day', () => {
  let g = e.newGame('kbo-lotte', 'Preseason', 'short', 44);
  const reserve = g.roster.find((p) => p.squad === 'reserve' && p.pos !== 'P');
  assert.equal(g.day, -28);
  assert.equal(g.phase, 'preseason');
  assert.equal(g.roster.filter((p) => p.squad === 'first').length, 28);
  while (g.phase === 'preseason') g = e.advance(g, 7);
  assert.equal(g.day, 0);
  assert.equal(g.phase, 'regular');
  assert.equal(g.history.length, 4);
  assert.ok(g.history.every((r) => r.friendly));
  for (const p of g.roster) assert.deepEqual(p.stats, e.blankStats());
  for (const rows of Object.values(g.standings))
    for (const s of rows) assert.equal(s.w + s.l + s.d, 0);
  assert.ok(g.reserve.w + g.reserve.l + g.reserve.d > 0);
  assert.ok(g.roster.some((p) => p.reserveStats?.g > 0));
  assert.ok(g.tacticFamiliarity > 55);
  assert.ok(reserve);
  g = e.advance(g, 1);
  assert.ok(g.roster.some((p) => p.stats.g > 0));
});

test('First-year restriction blocks both offers and previously accepted external deals, allows renewals and expires next year', () => {
  let g = e.newGame('mlb-dodgers', 'Ban', 'short', 22, { firstSeasonTransferBan: true });
  const external = e.marketPlayers(g).find((p) => p.club === 'fa');
  assert.throws(() => e.negotiate(g, external.id, external.salary * 2, 3), /첫 시즌/);
  const owned = g.roster[0];
  g = e.negotiate(g, owned.id, owned.salary * 2, 3, 'renew');
  g = waitForReply(e, g, g.deals[0].id);
  g = e.signDeal(g, g.deals[0].id);
  const unlocked = structuredClone(g);
  unlocked.rules.firstSeasonTransferBan = false;
  e.negotiate(unlocked, external.id, e.faDemand(unlocked, external), 3);
  waitForReply(e, unlocked, unlocked.deals[0].id);
  g.deals = unlocked.deals;
  assert.throws(() => e.signDeal(g, g.deals[0].id), /첫 시즌/);
  g.year++;
  assert.doesNotThrow(() => e.negotiate(g, external.id, external.salary * 2, 3));
});

test('Defensive swaps, bench replacements, position training and saved tactics remain coherent', () => {
  let g = e.newGame('kbo-lotte', 'Tactics', 'short', 28);
  const old = { ...g.defense },
    oldLineup = [...g.lineup];
  g = e.applyAction(g, { type: 'defense', id: old.LF, position: 'SS' });
  assert.equal(g.defense.SS, old.LF);
  assert.equal(g.defense.LF, old.SS);
  assert.deepEqual(g.lineup, oldLineup);
  const bench = g.roster.find(
    (p) => p.squad === 'first' && p.pos !== 'P' && !g.lineup.includes(p.id),
  );
  g = e.applyAction(g, { type: 'defense', id: bench.id, position: 'RF' });
  assert.equal(g.defense.RF, bench.id);
  assert.ok(g.lineup.includes(bench.id));
  assert.equal(new Set(Object.values(g.defense)).size, 10);
  assert.throws(() => e.applyAction(g, { type: 'defense', id: g.starter, position: 'SS' }));
  assert.throws(() =>
    e.applyAction(g, {
      type: 'defense',
      id: g.roster.find((p) => p.squad === 'reserve').id,
      position: 'RF',
    }),
  );
  g = e.applyAction(g, {
    type: 'instructions',
    value: { steal: 90, patience: 60, power: 20, depth: 45 },
  });
  g = e.applyAction(g, { type: 'saveTactic', name: '기동력' });
  const saved = structuredClone(g.tacticBook[0]);
  g = e.applyAction(g, { type: 'tactic', value: 'power' });
  g = e.applyAction(g, { type: 'loadTactic', id: saved.id });
  assert.deepEqual(g.instructions, saved.instructions);
  assert.deepEqual(g.defense, saved.defense);
  g = e.applyAction(g, { type: 'positionTraining', id: bench.id, position: 'SS' });
  g = e.advance(g, 7);
  assert.ok(g.roster.find((p) => p.id === bench.id).familiarity.SS > 0);
  assert.throws(() =>
    e.applyAction(g, {
      type: 'instructions',
      value: { steal: 101, patience: 50, power: 20, depth: 50 },
    }),
  );
});

test('Promotion limits, demotion and reserve stats survive save boundaries without leaking into first-team selection', () => {
  let g = e.newGame('kbo-lotte', 'Reserves', 'short', 5);
  const extra = g.roster.find((p) => p.squad === 'reserve' && p.pos !== 'P');
  g = e.applyAction(g, { type: 'squad', id: extra.id, value: 'first' });
  const reserve = g.roster.find((p) => p.squad === 'reserve' && p.pos === 'P');
  assert.throws(() => e.applyAction(g, { type: 'squad', id: reserve.id, value: 'first' }), /29명/);
  const demote = g.roster.find((p) => p.squad === 'first' && p.pos === 'P' && p.id !== g.starter);
  g = e.applyAction(g, { type: 'squad', id: demote.id, value: 'reserve' });
  g = e.applyAction(g, { type: 'squad', id: reserve.id, value: 'first' });
  g = structuredClone(g);
  g = e.advance(g, 7);
  assert.ok(g.roster.find((p) => p.id === g.starter).squad === 'first');
  assert.ok(g.lineup.every((id) => g.roster.find((p) => p.id === id).squad === 'first'));
  assert.ok(g.roster.some((p) => p.squad === 'reserve' && p.reserveStats?.g));
});

test('Official KBO additions include Jeon Min-jae and distinguish same-name players and real coaches', () => {
  assert.ok(catalogPlayers.some((p) => p.name === '전민재' && p.club === 'kbo-lotte' && p.real));
  const lee = catalogPlayers.filter(
    (p) => p.name === '이승현' && p.club === 'kbo-samsung' && p.real,
  );
  assert.equal(lee.length, 2);
  assert.equal(new Set(lee.map((p) => p.id)).size, 2);
  assert.equal(catalogCoaches.filter((c) => c.real).length, 96);
  assert.ok(
    catalogCoaches.some((c) => c.name === '문규현' && c.sourceClub === 'kbo-lotte' && c.real),
  );
  const g = e.newGame('kbo-lotte', 'Real coaches', 'short', 10);
  assert.ok(g.staff.every((c) => c.real && c.sourceClub === g.club));
});

test('Full-roster exchanges preserve batting order, defense, contracts and accumulated stats', () => {
  let g = e.newGame('kbo-lotte', 'Exchange', 'short', 81);
  g = e.applyAction(g, { type: 'lineup', ids: [...g.lineup].reverse() });
  const outgoing = g.roster.find((p) => p.id === g.lineup[2]);
  const incoming = g.roster.find((p) => p.squad === 'reserve' && p.pos === outgoing.pos);
  incoming.stats.h = 9;
  incoming.reserveStats = { ...incoming.stats, h: 21 };
  const before = structuredClone(g);
  const changed = e.applyAction(g, {
    type: 'squad',
    id: incoming.id,
    value: 'first',
    replaceId: outgoing.id,
  });
  assert.equal(changed.roster.filter((p) => p.squad !== 'reserve').length, 28);
  assert.equal(changed.roster.find((p) => p.id === outgoing.id).squad, 'reserve');
  assert.deepEqual(
    changed.lineup,
    g.lineup.map((id) => (id === outgoing.id ? incoming.id : id)),
  );
  assert.deepEqual(
    changed.defense,
    Object.fromEntries(
      Object.entries(g.defense).map(([pos, id]) => [pos, id === outgoing.id ? incoming.id : id]),
    ),
  );
  assert.deepEqual(changed.pitching, g.pitching);
  for (const p of changed.roster) {
    const old = before.roster.find((player) => player.id === p.id);
    for (const key of ['stats', 'reserveStats', 'salary', 'years', 'condition'])
      assert.deepEqual(p[key], old[key]);
  }
  assert.deepEqual(g, before);
});

test('Pitcher exchanges keep rotation slots, selected starter and relief group assignments', () => {
  const g = e.newGame('kbo-lotte', 'Pitcher exchange', 'short', 81);
  const incoming = g.roster.find((p) => p.squad === 'reserve' && p.pos === 'P');
  for (const outgoing of [
    g.starter,
    g.pitching.closer,
    g.pitching.setup[0],
    g.pitching.chase[0],
  ].filter(Boolean)) {
    const changed = e.applyAction(g, {
      type: 'squad',
      id: outgoing,
      value: 'reserve',
      replaceId: incoming.id,
    });
    const replace = (id) => (id === outgoing ? incoming.id : id);
    for (const key of ['rotation', 'bullpen', 'setup', 'chase'])
      assert.deepEqual(changed.pitching[key], g.pitching[key].map(replace));
    assert.equal(changed.pitching.closer, replace(g.pitching.closer));
    assert.equal(changed.starter, replace(g.starter));
    assert.deepEqual(changed.lineup, g.lineup);
  }
});

test('Exchanges allow the last catcher replacement and reject invalid targets without partial changes', () => {
  let g = e.newGame('kbo-lotte', 'Minimums', 'short', 81);
  const catchers = g.roster.filter((p) => p.pos === 'C' && p.squad !== 'reserve');
  for (const p of catchers.slice(1))
    g = e.applyAction(g, { type: 'squad', id: p.id, value: 'reserve' });
  const outgoing = catchers[0];
  const incoming = g.roster.find((p) => p.pos === 'C' && p.squad === 'reserve');
  assert.throws(
    () => e.applyAction(g, { type: 'squad', id: outgoing.id, value: 'reserve' }),
    /포수/,
  );
  const changed = e.applyAction(g, {
    type: 'squad',
    id: outgoing.id,
    value: 'reserve',
    replaceId: incoming.id,
  });
  assert.equal(changed.roster.find((p) => p.id === incoming.id).squad, 'first');
  const invalid = [
    outgoing.id,
    'missing-player',
    g.roster.find((p) => p.squad === 'reserve' && p.pos === 'P').id,
  ];
  const before = structuredClone(g);
  for (const replaceId of invalid)
    assert.throws(() =>
      e.applyAction(g, { type: 'squad', id: outgoing.id, value: 'reserve', replaceId }),
    );
  assert.deepEqual(g, before);
  const bench = g.roster.find(
    (p) => p.pos !== 'P' && p.squad !== 'reserve' && !g.lineup.includes(p.id),
  );
  if (bench) {
    const demoted = e.applyAction(g, { type: 'squad', id: bench.id, value: 'reserve' });
    assert.deepEqual(demoted.lineup, g.lineup);
    assert.deepEqual(demoted.defense, g.defense);
  }
});
