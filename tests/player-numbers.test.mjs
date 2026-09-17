import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const built = await build({
  stdin: {
    contents: "export * from './tests/fixtures/engine';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { engine } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);

test('선수 등번호를 저장하고 중복·범위·타 구단 변경을 거부한다', () => {
  let g = engine.newGame('kbo-kia', '등번호 감독', 'short', 72, { preseason: false });
  const [first, second] = g.roster.filter((p) => p.club === g.club).slice(0, 2);
  g = engine.applyAction(g, { type: 'playerNumber', id: first.id, number: 99 });
  assert.equal(g.roster.find((p) => p.id === first.id).number, 99);
  assert.throws(
    () => engine.applyAction(g, { type: 'playerNumber', id: second.id, number: 99 }),
    /이미/,
  );
  assert.throws(
    () => engine.applyAction(g, { type: 'playerNumber', id: second.id, number: 100 }),
    /1번부터/,
  );
  assert.throws(
    () => engine.applyAction(g, { type: 'playerNumber', id: 'other-club-player', number: 1 }),
    /선수단/,
  );
});
