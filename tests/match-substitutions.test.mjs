import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['apps/web/src/features/matches/match-substitutions.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { matchSubstitutions } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const players = [
  'away-starter',
  'away-relief',
  'home-starter',
  'home-relief',
  'manual',
  'closer',
].map((id) => ({ id, name: id }));
const play = (half, pitcher, pitchingChange) => ({
  inning: 7,
  half,
  play: { pitcher, ...(pitchingChange ? { pitchingChange } : {}) },
});
const meta = {
  from: 'home-starter',
  reason: 'starter-limit',
  outs: 17,
  runs: 2,
  lead: 5,
  role: 'chase',
  energy: 50,
};
const result = {
  home: 'home',
  away: 'away',
  replayTeams: [
    { defense: { P: 'away-starter' }, players },
    { defense: { P: 'home-starter' }, players },
  ],
  log: [
    play(0, 'home-starter'),
    play(1, 'away-starter'),
    play(0, 'home-relief', meta),
    play(0, 'home-relief'),
    play(1, 'away-relief'),
    play(0, 'manual'),
    play(0, 'closer', { ...meta, from: 'manual', reason: 'save', lead: 2, role: 'closer' }),
  ],
};

test('automatic pitching notices appear at the entry play and never reveal future substitutions', () => {
  assert.deepEqual(matchSubstitutions(result, 0, 'home'), []);
  assert.deepEqual(matchSubstitutions(result, 2, 'home'), []);
  const first = matchSubstitutions(result, 3, 'home');
  assert.equal(first.length, 1);
  assert.equal(first[0].from, 'home-starter');
  assert.equal(first[0].to, 'home-relief');
  assert.equal(first[0].own, true);
  assert.equal(first[0].role, '추격조');
  assert.match(first[0].reason, /5⅔이닝/);
  assert.deepEqual(matchSubstitutions(result, 4, 'home'), first);
  assert.equal(matchSubstitutions(result, 5, 'home')[1].own, false);
  assert.ok(!JSON.stringify(matchSubstitutions(result, 6, 'home')).includes('2점 리드'));
});
test('manual changes are omitted while older automatic changes use a neutral explanation', () => {
  const events = matchSubstitutions(result, 7, 'home', [{ cursor: 5, pitcher: 'manual' }]);
  assert.equal(events.length, 3);
  assert.ok(events.every((event) => event.to !== 'manual'));
  assert.match(events[1].reason, /운용 계획/);
  assert.match(events[2].reason, /2점 리드/);
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.deepEqual(
    matchSubstitutions(result, 99, 'home', [{ cursor: 5, pitcher: 'manual' }]),
    events,
  );
});
test('recorded fatigue, poor results and closer protection produce distinct reasons', () => {
  for (const [reason, expected] of [
    ['fatigue', /50%/],
    ['runs', /2실점/],
    ['protect-closer', /5점 차/],
  ]) {
    const changed = { ...result, log: [play(0, 'home-relief', { ...meta, reason })] };
    assert.match(matchSubstitutions(changed, 1, 'home')[0].reason, expected);
  }
});
