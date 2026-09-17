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

test('주장단 선임은 사기를 높이고 중복·타 구단 선수를 거부한다', () => {
  let g = engine.newGame('kbo-kia', '주장 감독', 'short', 71, { preseason: false });
  const captain = g.roster.find((p) => p.club === g.club && p.pos !== 'P');
  const vice = g.roster.find((p) => p.club === g.club && p.pos !== 'P' && p.id !== captain.id);
  g = engine.applyAction(g, { type: 'setCaptain', captain: captain.id, viceCaptain: vice.id });
  assert.equal(g.captain, captain.id);
  assert.equal(g.viceCaptain, vice.id);
  assert.match(g.news.at(-1).title, /주장단/);
  assert.throws(
    () =>
      engine.applyAction(g, { type: 'setCaptain', captain: captain.id, viceCaptain: captain.id }),
    /부주장/,
  );
  assert.throws(
    () => engine.applyAction(g, { type: 'setCaptain', captain: 'foreign', viceCaptain: undefined }),
    /선수단/,
  );
});
