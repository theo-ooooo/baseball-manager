import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['packages/shared/src/player-leaders.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { playerLeaders, leaderValueLabel, inningsLabel } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const player = (id, pos, stats) => ({
  id,
  name: id,
  club: 'club',
  pos,
  stats: { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, outs: 0, er: 0, wins: 0, g: 0, ...stats },
});
test('batting leaders exclude tiny rate samples, include counting leaders and preserve ties', () => {
  const players = [
    player('가', 'OF', { ab: 28, bb: 2, sh: 1, h: 10, hr: 3, g: 10 }),
    player('나', 'IF', { ab: 1, h: 1, hr: 5, g: 1 }),
    player('다', 'C', { ab: 31, h: 9, hr: 3, g: 10 }),
    player('미출전', 'OF', {}),
  ];
  const games = new Map([['club', 10]]);
  assert.deepEqual(
    playerLeaders(players, games, 'avg').map((r) => r.player.id),
    ['가', '다'],
  );
  assert.equal(playerLeaders(players, games, 'avg', false)[0].player.id, '나');
  assert.deepEqual(
    playerLeaders(players, games, 'hr').map((r) => [r.player.id, r.rank]),
    [
      ['나', 1],
      ['가', 2],
      ['다', 2],
    ],
  );
  assert.equal(leaderValueLabel(players[0], 'avg'), '.357');
  assert.equal(players[0].stats.ab, 28);
  assert.deepEqual(playerLeaders(players, new Map(), 'avg'), []);
});
test('pitching leaders use outs for ERA and qualification, while relievers can lead saves', () => {
  const pitchers = [
    player('선발', 'P', { outs: 32, er: 4, k: 12, wins: 2, g: 2 }),
    player('마무리', 'P', { outs: 3, er: 0, saves: 1, g: 1 }),
    player('동률', 'P', { outs: 40, er: 5, k: 12, g: 3 }),
    player('무아웃', 'P', { outs: 0, er: 1, g: 1 }),
  ];
  const games = new Map([['club', 10]]);
  assert.deepEqual(
    playerLeaders(pitchers, games, 'era').map((r) => r.rank),
    [1, 1],
  );
  assert.equal(playerLeaders(pitchers, games, 'era', false)[0].player.id, '마무리');
  assert.equal(playerLeaders(pitchers, games, 'saves')[0].player.id, '마무리');
  assert.equal(leaderValueLabel(pitchers[0], 'era'), '3.38');
  assert.equal(leaderValueLabel(pitchers[3], 'era'), '—');
  assert.equal(inningsLabel(32), '10.2');
});
