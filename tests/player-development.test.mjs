import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = join(tmpdir(), 'dugout-development-test.cjs');
buildSync({
  entryPoints: ['tests/fixtures/development.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
const {
  engine: e,
  prepareDevelopment,
  developPlayers,
  developmentReports,
  presentState,
} = createRequire(import.meta.url)(out);
const keys = ['contact', 'power', 'speed', 'field', 'stuff', 'control'];
const game = () => e.newGame('kbo-lotte', 'Growth', 'full', 36);
function training(g, days = 28, appear = false) {
  for (let i = 0; i < days; i++) {
    if (appear)
      for (const p of g.roster) {
        p.reserveStats ??= e.blankStats();
        p.reserveStats.g++;
      }
    developPlayers(g);
    g.day++;
    developmentReports(g);
  }
  return g;
}

test('Legacy players gain persistent individual curves without changing abilities, records or contracts', () => {
  const g = game();
  for (const p of g.roster) delete p.development;
  const original = structuredClone(g),
    seed = g.seed;
  prepareDevelopment(g);
  assert.ok(new Set(g.roster.map((p) => p.development.pattern)).size >= 3);
  for (const p of g.roster) {
    const d = p.development;
    assert.equal(d.history.length, 1);
    const copy = structuredClone(p);
    delete copy.development;
    assert.deepEqual(
      copy,
      original.roster.find((v) => v.id === p.id),
    );
  }
  const once = structuredClone(g);
  prepareDevelopment(g);
  assert.deepEqual(g, once);
  assert.equal(g.seed, seed);
  for (const reveal of [false, true]) {
    g.rules.revealPotential = reveal;
    const publicState = presentState(g);
    assert.ok(publicState.roster.every((p) => !p.development.curve));
    if (!reveal) assert.ok(publicState.roster.every((p) => p.potential === 0));
  }
});

test('Same-age players can be growing or peaking; daily aging decline is gradual and ability-specific', () => {
  const g = game();
  for (const p of g.roster) p.age = 27;
  prepareDevelopment(g);
  assert.ok(g.roster.some((p) => p.development.stage === 'growth'));
  assert.ok(g.roster.some((p) => p.development.stage === 'peak'));
  const veteran = g.roster.find((p) => p.pos === 'P');
  veteran.age = 42;
  veteran.stuff = 70;
  veteran.control = 70;
  veteran.speed = 70;
  const before = structuredClone(veteran);
  developPlayers(g);
  assert.equal(veteran.development.stage, 'decline');
  assert.ok(veteran.stuff < before.stuff && veteran.control < before.control);
  assert.ok(before.speed - veteran.speed > before.control - veteran.control);
  assert.ok(before.stuff - veteran.stuff < 0.2);
  const trained = structuredClone(g);
  developPlayers(g);
  assert.deepEqual(g, trained);
});

test('Coaching, playing time and training change growth while hidden potential remains a ceiling', () => {
  const base = game();
  const p = base.roster.find((p) => p.squad === 'reserve' && p.pos !== 'P' && !p.real);
  p.age = 19;
  for (const k of keys) p[k] = 50;
  p.potential = 80;
  prepareDevelopment(base);
  const strong = structuredClone(base),
    idle = structuredClone(base);
  for (const c of strong.staff) c.skill = 95;
  for (const c of idle.staff) c.skill = 35;
  idle.training = 'rest';
  training(strong, 28, true);
  training(idle, 28, false);
  assert.ok(
    strong.roster.find((v) => v.id === p.id).contact >
      idle.roster.find((v) => v.id === p.id).contact + 0.2,
  );
  const capped = structuredClone(base),
    target = capped.roster.find((v) => v.id === p.id);
  target.potential = 50.01;
  training(capped, 28, true);
  assert.ok(target.contact <= 50.01);
  assert.ok(target.power <= 50.01);
});

test('Growth resumes deterministically from saved history and monthly reports use observed deltas', () => {
  const a = game();
  training(a, 12, true);
  const b = JSON.parse(JSON.stringify(a));
  training(a, 16, true);
  training(b, 16, true);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
  assert.ok(a.roster.every((p) => p.development.history.length === 2));
  const report = a.news.find((n) => n.kind === 'development');
  assert.ok(report);
  assert.equal(report.actionView, 'squad');
  assert.ok(report.report.players.length > 0);
  assert.ok(report.report.players.some((p) => /↗|↘/.test(p.detail)));
  assert.ok(report.report.facts.some((f) => f.label === '능력 상승'));
  const snapshot = structuredClone(report);
  const observed = a.roster.find((p) => p.id === report.report.players[0].id);
  observed.contact += 2;
  const count = a.news.length;
  developmentReports(a);
  assert.equal(a.news.length, count);
  assert.deepEqual(report, snapshot);
  const raw = game();
  for (let i = 0; i < 28; i++) e.advance(raw, 1);
  assert.ok(raw.news.some((n) => n.title === '선수 성장·하락 보고'));
  assert.ok(
    raw.roster.every((p) => keys.every((k) => Number.isFinite(p[k]) && p[k] >= 20 && p[k] <= 99)),
  );
});
