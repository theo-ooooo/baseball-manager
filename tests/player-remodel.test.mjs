import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-remodel-tests.cjs');
buildSync({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './apps/api/src/domain/player-remodel';export * from './apps/api/src/domain/player-development';export * from './apps/api/src/domain/world-simulation';export * from './packages/shared/src/player-remodel';export * from './packages/shared/src/calendar';export * from './packages/shared/src/game-view';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  world,
  advanceRemodel,
  remodelAction,
  developPlayers,
  saveWorldPlayer,
  createGameView,
  REMODEL_DAYS,
} = createRequire(import.meta.url)(out);
function base() {
  const g = e.newGame('kbo-lotte', '폼 감독', 'short', 34, { preseason: false });
  const p = g.roster.find((p) => p.pos !== 'P');
  p.contact = 65;
  p.power = 60;
  p.field = 65;
  p.potential = 90;
  p.condition = 100;
  delete p.injury;
  delete p.trainingPlan;
  g.weather.seed = 0;
  return { g, p };
}
const training = { rest: false };
test('Remodel requires real training days, pauses during injury, personal rest and low condition, and completes once', () => {
  const { g, p } = base(),
    seed = g.seed;
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' });
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.days, 0);
  g.day++;
  p.injury = { returnDate: '2026-12-31' };
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.days, 0);
  delete p.injury;
  p.condition = 30;
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.days, 0);
  p.condition = 100;
  advanceRemodel(g, p, { rest: true });
  assert.equal(p.remodel.days, 0);
  p.internationalDuty = {};
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.days, 0);
  delete p.internationalDuty;
  for (let i = 0; i < REMODEL_DAYS; i++) {
    g.day++;
    advanceRemodel(g, p, training);
    advanceRemodel(g, p, training);
    if (i < REMODEL_DAYS - 1) assert.equal(p.power, 60);
  }
  assert.equal(p.remodel.status, 'completed');
  assert.equal(p.power, 64);
  assert.equal(p.contact, 63);
  assert.equal(p.remodel.days, REMODEL_DAYS);
  g.day++;
  advanceRemodel(g, p, training);
  assert.equal(p.power, 64);
  assert.equal(g.news.filter((n) => n.id.startsWith('remodel:')).length, 1);
  assert.equal(g.seed, seed);
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'contact' }),
    /한 시즌/,
  );
});
test('Normal player development delivers remodel completion to actual match abilities and deduplicates same-day training', () => {
  const { g, p } = base();
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' });
  p.remodel.days = REMODEL_DAYS - 1;
  g.day++;
  const before = p.power;
  developPlayers(g);
  assert.equal(p.remodel.status, 'completed');
  assert.ok(p.power >= before + 3.9);
  const after = p.power;
  developPlayers(g);
  assert.equal(p.power, after);
  const actual = e.applyAction(g, { type: 'startMatch' });
  assert.ok(actual.liveMatch);
  assert.ok(
    actual.liveMatch.prepared.input.roster.some((x) => x.id === p.id && x.power === p.power),
  );
});
test('Remodel validates roster, role and coaching capacity; cancellation cannot reset seasonal use', () => {
  const { g, p } = base();
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: 'foreign', kind: 'slugger' }),
    /소属|소속/,
  );
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'command' }),
    /투타/,
  );
  const players = g.roster.filter((p) => p.pos !== 'P').slice(0, 4);
  for (const v of players) {
    v.power = 55;
    v.contact = 60;
    v.potential = 90;
  }
  for (const v of players.slice(0, 3))
    remodelAction(g, { type: 'startRemodel', id: v.id, kind: 'slugger' });
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: players[3].id, kind: 'slugger' }),
    /세 명/,
  );
  remodelAction(g, { type: 'cancelRemodel', id: p.id });
  assert.equal(p.power, 55);
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' }),
    /한 시즌/,
  );
  g.liveMatch = {};
  assert.throws(() => remodelAction(g, { type: 'cancelRemodel', id: players[1].id }), /경기/);
});
test('Limited headroom scales the cost; saved world players retain completed remodel when reacquired', () => {
  const { g, p } = base();
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' });
  p.potential = 61;
  p.remodel.days = REMODEL_DAYS - 1;
  g.day++;
  advanceRemodel(g, p, training);
  assert.equal(p.power, 61);
  assert.equal(p.contact, 64.5);
  p.club = 'kbo-doosan';
  saveWorldPlayer(g, p);
  g.roster = g.roster.filter((v) => v.id !== p.id);
  const moved = createGameView(world)
    .rosterFor(g, 'kbo-doosan')
    .find((v) => v.id === p.id);
  assert.equal(moved.remodel.status, 'completed');
  assert.equal(moved.power, 61);
});
test('Club change cancels unfinished remodel without bonuses and new seasons permit a fresh project', () => {
  const { g, p } = base();
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' });
  g.day++;
  p.remodel.club = 'another-club';
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.status, 'cancelled');
  assert.equal(p.power, 60);
  g.year++;
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'contact' });
  assert.equal(p.remodel.status, 'training');
  assert.equal(p.remodel.year, g.year);
});

test('A project crossing the offseason consumes the completion season too', () => {
  const { g, p } = base();
  remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'slugger' });
  p.remodel.days = REMODEL_DAYS - 1;
  g.year++;
  g.day++;
  advanceRemodel(g, p, training);
  assert.equal(p.remodel.finishedYear, g.year);
  assert.throws(
    () => remodelAction(g, { type: 'startRemodel', id: p.id, kind: 'contact' }),
    /한 시즌/,
  );
});
