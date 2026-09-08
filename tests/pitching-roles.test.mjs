import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
function bundle(entry, name) {
  const outfile = join(tmpdir(), `dugout-roles-${name}.cjs`);
  buildSync({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs' });
  return require(outfile);
}
const { engine: e } = bundle('tests/fixtures/engine.ts', 'engine');
const { pitchingAssignment, pitchingRole } = bundle('packages/shared/src/pitching.ts', 'view');
const { selectReliever } = bundle('apps/api/src/domain/relief-selection.ts', 'selection');

test('Legacy bullpen gains groups without changing starter, rotation, closer, contracts or results', () => {
  const old = e.newGame('kbo-lotte', 'Legacy roles', 'short', 303);
  delete old.pitching.setup;
  delete old.pitching.chase;
  const upgraded = e.applyAction(old, { type: 'syncCatalog' });
  for (const key of ['rotation', 'closer', 'bullpen', 'next'])
    assert.deepEqual(upgraded.pitching[key], old.pitching[key]);
  for (const key of ['starter', 'lineup', 'roster', 'budget', 'history', 'day'])
    assert.deepEqual(upgraded[key], old[key]);
  const { setup, chase, bullpen } = upgraded.pitching;
  assert.ok(setup.length && chase.length);
  assert.equal(new Set([...setup, ...chase]).size, setup.length + chase.length);
  assert.ok([...setup, ...chase].every((id) => bullpen.includes(id)));
  assert.deepEqual(e.applyAction(upgraded, { type: 'syncCatalog' }), upgraded);
});

test('Assignments, empty groups, saved tactics and reserve moves preserve exclusive pitcher roles', () => {
  let g = e.newGame('kbo-lotte', 'Roles', 'short', 44);
  const id = g.pitching.bullpen[0];
  for (const role of ['setup', 'chase', 'bullpen', 'closer', 'starter']) {
    g = e.applyAction(g, { type: 'pitchingRole', id, role });
    const player = g.roster.find((p) => p.id === id);
    assert.equal(pitchingAssignment(g, player), role);
    assert.equal(g.pitching.setup.includes(id), role === 'setup');
    assert.equal(g.pitching.chase.includes(id), role === 'chase');
    assert.equal(g.pitching.bullpen.includes(id), ['setup', 'chase', 'bullpen'].includes(role));
  }
  const rotation = [...g.pitching.rotation];
  g = e.applyAction(g, { type: 'pitchingRole', id, role: 'starter' });
  assert.deepEqual(g.pitching.rotation, rotation);
  g = e.applyAction(g, { type: 'pitchingRole', id, role: 'setup' });
  g = e.applyAction(g, { type: 'saveTactic', name: '접전 운용' });
  const saved = structuredClone(g.pitching);
  for (const relief of [...g.pitching.setup, ...g.pitching.chase])
    g = e.applyAction(g, { type: 'pitchingRole', id: relief, role: 'bullpen' });
  assert.deepEqual(e.applyAction(g, { type: 'syncCatalog' }).pitching.setup, []);
  assert.deepEqual(e.applyAction(g, { type: 'syncCatalog' }).pitching.chase, []);
  g = e.applyAction(g, { type: 'loadTactic', id: g.tacticBook[0].id });
  assert.deepEqual(g.pitching, saved);
  g = e.applyAction(g, { type: 'squad', id, value: 'reserve' });
  assert.ok(!g.pitching.setup.includes(id) && !g.pitching.bullpen.includes(id));
  assert.equal(
    pitchingRole(
      g,
      g.roster.find((p) => p.id === id),
    ),
    '2군',
  );
  assert.throws(() => e.applyAction(g, { type: 'pitchingRole', id, role: 'chase' }), /1군/);
});

test('Situation, fatigue and used pitchers determine relief priority without using reserve starters', () => {
  const plan = {
    rotation: ['starter'],
    closer: 'closer',
    bullpen: ['general', 'setup', 'chase'],
    setup: ['setup'],
    chase: ['chase'],
    next: 0,
  };
  const roster = [...plan.rotation, ...plan.bullpen, plan.closer].map((id) => ({
    id,
    pos: 'P',
    condition: 90,
  }));
  const select = (inning, lead, used = [], players = roster) =>
    selectReliever({ plan, roster: players, used: new Set(used), inning, lead })?.id;
  assert.equal(select(4, 0), 'general');
  assert.equal(select(7, 0), 'setup');
  assert.equal(select(8, 2), 'setup');
  assert.equal(select(7, -1), 'chase');
  assert.equal(select(7, 5), 'general');
  assert.equal(select(9, 3), 'closer');
  assert.equal(select(9, 0), 'setup');
  assert.equal(select(9, -3), 'chase');
  assert.equal(select(9, 1, ['closer', 'setup']), 'general');
  assert.equal(
    select(
      7,
      1,
      [],
      roster.map((p) => ({ ...p, condition: p.id === 'setup' ? 40 : 90 })),
    ),
    'general',
  );
  assert.equal(
    select(
      7,
      -1,
      [],
      roster.map((p) => ({ ...p, squad: p.id === 'chase' ? 'reserve' : 'first' })),
    ),
    'general',
  );
  assert.equal(select(8, 1, plan.bullpen), undefined);
  assert.equal(select(10, 1, [...plan.bullpen, plan.closer]), undefined);
  assert.equal(
    select(
      7,
      1,
      [],
      roster.map((p) => ({ ...p, condition: 30 })),
    ),
    'setup',
  );
});

test('Choosing the next starter also updates their relief assignment without shifting existing starters', () => {
  let g = e.newGame('kbo-lotte', 'Manual starter', 'short', 95);
  const id = g.pitching.setup[0];
  const rotation = [...g.pitching.rotation];
  g = e.applyAction(g, { type: 'starter', id });
  assert.equal(g.starter, id);
  assert.deepEqual(g.pitching.rotation, [...rotation, id]);
  assert.equal(g.pitching.next, rotation.length);
  assert.ok(!g.pitching.bullpen.includes(id) && !g.pitching.setup.includes(id));
  assert.equal(
    pitchingAssignment(
      g,
      g.roster.find((p) => p.id === id),
    ),
    'starter',
  );
});

test('A live match saved before bullpen groups reproduces its original complete result', () => {
  // Frozen synthetic save from before growth curves; do not regenerate it with today's training rules.
  let g = JSON.parse(
    readFileSync(new URL('./fixtures/legacy-pitching-input.json', import.meta.url), 'utf8'),
  ).state;
  for (let n = 0; !g.liveMatch.finished && n < 400; n++) {
    if (n === 60) g = JSON.parse(JSON.stringify(g));
    g = e.applyAction(g, { type: 'stepMatch' });
  }
  assert.ok(g.liveMatch.finished);
  // Recorded from the deployed pre-group engine with this deterministic seed.
  assert.equal(
    createHash('sha256').update(JSON.stringify(g.liveMatch.result)).digest('hex'),
    'c3e61e7e9a91ee33dbd0df6445dd8d574d81cdba2eea1a31f567ffe3ee53b617',
  );
});

test('A new career recommends a recorded starter and keeps the leading save pitcher as closer', () => {
  const g = e.newGame('kbo-lotte', '', 'short', 51);
  const leader = g.roster
    .filter((p) => p.pos === 'P' && p.squad !== 'reserve')
    .sort((a, b) => (b.rating?.record?.sv || 0) - (a.rating?.record?.sv || 0))[0];
  assert.equal(g.pitching.closer, leader.id);
  assert.equal(g.starter, g.pitching.rotation[0]);
  assert.notEqual(g.starter, leader.id);
  assert.equal(g.defense.P, g.starter);
  assert.equal(g.manager, '신임 감독');
});

test('New live games actually use saved bullpen priorities at each pitching change', () => {
  const situations = new Set();
  for (const seed of [51, 407, 931]) {
    let g = e.newGame('kbo-lotte', 'Relief integration', 'short', seed);
    g = e.applyAction(g, { type: 'continue' });
    const baseline = structuredClone(g);
    g = e.applyAction(g, { type: 'startMatch' });
    assert.equal(g.liveMatch.pitchingVersion, 2);
    const defending = g.liveMatch.home === g.club ? 1 : 0;
    for (let n = 0; !g.liveMatch.finished && n < 400; n++)
      g = e.applyAction(g, { type: 'stepMatch' });
    assert.ok(g.liveMatch.finished);
    const used = new Set([baseline.starter]);
    for (const row of g.liveMatch.result.log) {
      if (!row.play || row.half === defending || used.has(row.play.pitcher)) continue;
      const lead = row.play.before.score[defending] - row.play.before.score[1 - defending];
      const expected = selectReliever({
        plan: baseline.pitching,
        roster: baseline.roster,
        used,
        inning: row.inning,
        lead,
      });
      assert.equal(row.play.pitcher, expected?.id);
      situations.add(lead < 0 ? 'behind' : 'level-or-ahead');
      used.add(row.play.pitcher);
    }
    assert.ok(used.size > 1);
  }
  assert.deepEqual([...situations].sort(), ['behind', 'level-or-ahead']);
});
