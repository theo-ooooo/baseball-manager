import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const outfile = join(tmpdir(), 'dugout-international-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/international';export * from './packages/shared/src/international';export * from './packages/shared/src/calendar';export * from './packages/shared/src/long-term';export * from './packages/shared/src/international-replacement';",
    resolveDir: process.cwd(),
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  engine: e,
  world,
  internationalCalendar,
  createInternational,
  selectInternationalPlayers,
  daysBetween,
  isAvailable,
  nationalReplacement,
} = createRequire(import.meta.url)(outfile);
const newGame = () => e.newGame('kbo-lotte', '국가대표 검증', 'full', 183, { preseason: false });
const date = (g, value) => {
  g.day = daysBetween(g.calendar.openingDate, value);
};

test('International calendar distinguishes confirmed dates from game estimates and does not invent future Olympics', () => {
  const [wbc, asian] = internationalCalendar(2026);
  assert.equal(wbc.start, '2026-03-05');
  assert.equal(wbc.end, '2026-03-17');
  assert.equal(asian.start, '2026-09-21');
  assert.equal(asian.returnDate, '2026-09-29');
  assert.equal(asian.estimated, false);
  assert.equal(internationalCalendar(2027)[0].estimated, true);
  assert.equal(internationalCalendar(2028)[0].end, '2028-07-19');
  assert.equal(
    internationalCalendar(2032).some((e) => e.kind === 'olympic'),
    false,
  );
  assert.ok(internationalCalendar(2030).every((e) => e.estimated));
});
test('Asian Games selection respects Korean age, wildcard and club limits with one deterministic selection', () => {
  const g = newGame(),
    event = internationalCalendar(2026).find((e) => e.kind === 'asian');
  const players = world.clubs.flatMap((c) => e.rosterFor(g, c.id));
  const ids = selectInternationalPlayers(players, event);
  const selected = players.filter((p) => ids.includes(p.id)),
    korea = selected.filter((p) => p.country === '대한민국');
  assert.equal(korea.length, 24);
  assert.equal(korea.filter((p) => p.pos === 'P').length, 11);
  assert.ok(korea.every((p) => p.age <= 29));
  assert.ok(korea.filter((p) => p.age > 25).length <= 3);
  const clubs = new Map();
  for (const p of selected) clubs.set(p.club, (clubs.get(p.club) || 0) + 1);
  assert.ok([...clubs.values()].every((n) => n <= 3));
  assert.ok(!selected.some((p) => p.country === '일본'));
  assert.deepEqual(selectInternationalPlayers(players, event), ids);
});
test('Callup announcements, departure, AI availability and return are persisted exactly once', () => {
  const g = newGame(),
    service = createInternational(world),
    event = internationalCalendar(2026).find((e) => e.kind === 'asian');
  date(g, event.announce);
  service.tick(g);
  const selected = g.international.events.find((e) => e.id === event.id);
  assert.equal(selected.stage, 'selected');
  assert.ok(selected.players.length > 0);
  assert.ok(g.roster.every(isAvailable));
  const before = structuredClone(g);
  service.tick(g);
  assert.deepEqual(g, before);
  date(g, event.departure);
  service.tick(g);
  const own = g.roster.filter((p) => p.internationalDuty);
  assert.ok(own.length > 0);
  assert.ok(own.every((p) => !isAvailable(p)));
  assert.ok(g.lineup.every((id) => !own.some((p) => p.id === id)));
  assert.ok(!own.some((p) => p.id === g.starter));
  const rival = world.clubs
    .filter((c) => c.id !== g.club)
    .flatMap((c) => e.rosterFor(g, c.id))
    .find((p) => p.internationalDuty);
  assert.ok(rival);
  assert.equal(isAvailable(rival), false);
  const reloaded = JSON.parse(JSON.stringify(g));
  assert.equal(
    e.rosterFor(reloaded, rival.club).find((p) => p.id === rival.id).internationalDuty.id,
    event.id,
  );
  date(g, event.returnDate);
  service.tick(g);
  assert.ok(g.roster.every((p) => !p.internationalDuty));
  assert.ok(!e.rosterFor(g, rival.club).find((p) => p.id === rival.id).internationalDuty);
  assert.equal(g.international.events.find((e) => e.id === event.id).stage, 'returned');
  assert.equal(g.news.filter((n) => n.internationalEventId === event.id).length, 3);
  const returned = structuredClone(g);
  service.tick(g);
  assert.deepEqual(g, returned);
});
test('One-click replacements obey normal registration and recall rules, and refuse stale recommendations', () => {
  let g = newGame();
  const service = createInternational(world),
    event = internationalCalendar(2026).find((e) => e.kind === 'asian');
  date(g, event.departure);
  service.tick(g);
  const outgoing = g.roster.find(
    (p) => p.internationalDuty && p.squad !== 'reserve' && nationalReplacement(g, p.id),
  );
  assert.ok(outgoing);
  const incoming = nationalReplacement(g, outgoing.id),
    before = g.roster.filter((p) => p.squad !== 'reserve').length;
  g = e.applyAction(g, {
    type: 'internationalReplacement',
    id: outgoing.id,
    replacementId: incoming.id,
  });
  assert.equal(g.roster.find((p) => p.id === incoming.id).squad, 'first');
  assert.equal(g.roster.find((p) => p.id === outgoing.id).squad, 'reserve');
  assert.equal(g.roster.filter((p) => p.squad !== 'reserve').length, before);
  assert.throws(() =>
    e.applyAction(g, {
      type: 'internationalReplacement',
      id: outgoing.id,
      replacementId: incoming.id,
    }),
  );
  assert.throws(
    () =>
      e.applyAction(g, { type: 'squad', id: outgoing.id, value: 'first', replaceId: incoming.id }),
    /차출/,
  );
});
test('Active frozen matches are unchanged by callup ticks and late starts do not replay past competitions', () => {
  let g = newGame();
  g = e.applyAction(g, { type: 'startMatch' });
  const live = structuredClone(g);
  createInternational(world).tick(g);
  assert.deepEqual(g, live);
  const late = newGame();
  date(late, '2026-10-01');
  createInternational(world).tick(late);
  assert.ok(!late.international.events.length);
  assert.ok(late.roster.every((p) => !p.internationalDuty));
});
