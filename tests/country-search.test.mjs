import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const built = await build({
  entryPoints: ['packages/shared/src/countries.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { searchCountries, gameCountries, countryPath, participatesInTournament } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
test('Country search handles Korean aliases, English and combined league countries', () => {
  const countries = gameCountries([{ country: '미국 · 캐나다' }, { country: '대한민국' }]);
  assert.deepEqual(searchCountries('한국', countries), ['대한민국']);
  assert.deepEqual(searchCountries('South Korea', countries), ['대한민국']);
  assert.deepEqual(searchCountries('USA', countries), ['미국']);
  assert.deepEqual(searchCountries('캐나다', countries), ['캐나다']);
  assert.deepEqual(searchCountries('', countries), []);
  assert.ok(!countries.includes('미국 · 캐나다'));
  assert.equal(decodeURIComponent(countryPath('대한민국')), '/countries/대한민국');
});
test('Country pages do not substitute Korea for a country excluded from an event', () => {
  assert.equal(participatesInTournament('일본', 'asian'), false);
  assert.equal(participatesInTournament('대한민국', 'asian'), true);
  assert.equal(participatesInTournament('중국', 'asian'), true);
  assert.equal(participatesInTournament('미국', 'wbc'), true);
  assert.equal(participatesInTournament('없는 국가', 'wbc'), false);
});
