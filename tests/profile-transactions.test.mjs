import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const result = await build({
  stdin: {
    contents:
      "export * from './tests/fixtures/engine';export * from './packages/shared/src/player-profile-view';export * from './packages/shared/src/contract-status';export {playerPosition} from './packages/shared/src/management';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  engine: e,
  playerAssessment,
  visibleOverall,
  playerContractContext,
  playerPosition,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
test('Unknown and range-scouted profiles never derive strengths or exact ratings from hidden attributes', () => {
  const p = e.newGame('kbo-lotte', '관찰 QA', 'short', 700).roster[0];
  p.observation = { status: 'unknown' };
  assert.equal(visibleOverall(p), undefined);
  assert.equal(playerAssessment(p).strengths.length, 0);
  assert.ok(playerAssessment(p).attributes.every((a) => a.value === null && a.text === '?'));
  p.observation = {
    status: 'scouted',
    date: '2026-03-01',
    overall: [51, 61],
    abilities: { contact: [50, 60], power: [40, 50], stuff: [55, 65], control: [60, 70] },
  };
  const before = structuredClone(playerAssessment(p));
  p.contact = 99;
  p.power = 1;
  p.stuff = 3;
  p.control = 99;
  p.speed = 100;
  p.field = 1;
  assert.deepEqual(playerAssessment(p), before);
  assert.equal(visibleOverall(p), 56);
});
test('A cash trade transfers current contract and money, closes old renewals, and cannot negotiate for the former employer', () => {
  let g = e.newGame('mlb-dodgers', '트레이드 QA', 'short', 7);
  const p = g.roster.find((p) => p.squad === 'reserve' && !p.real);
  g = e.applyAction(g, { type: 'listPlayer', id: p.id });
  g = e.advance(g, 3);
  const offer = g.saleOffers.find((o) => o.playerId === p.id);
  assert.ok(offer);
  assert.equal(e.getClub(offer.club).league, e.getClub(g.club).league);
  g = e.negotiate(g, p.id, p.salary * 2, 3, 'renew');
  const contract = { salary: p.salary, years: p.years };
  const before = g.budget,
    buyer = g.simulation.clubs[offer.club]?.balance ?? e.teamBudget('mlb');
  g = e.applyAction(g, { type: 'sell', id: p.id, offerId: offer.id });
  const moved = e.marketPlayers(g).find((v) => v.id === p.id);
  assert.equal(moved.club, offer.club);
  assert.deepEqual({ salary: moved.salary, years: moved.years }, contract);
  assert.equal(g.budget, before + offer.fee);
  assert.equal(g.simulation.clubs[offer.club].balance, buyer - offer.fee);
  assert.equal(
    g.deals.some((d) => d.player.id === p.id),
    false,
  );
  const scope = playerContractContext(g, moved);
  assert.equal(scope.own, false);
  assert.equal(scope.allowed, false);
  assert.equal(scope.deal, undefined);
  assert.throws(() => e.negotiate(g, p.id, 99999, 3, 'renew'), /찾을 수/);
  assert.throws(() => e.negotiate(g, p.id, 99999, 3, 'buy'), /트레이드/);
  assert.ok(e.rosterFor(g, offer.club).some((v) => v.id === p.id));
  assert.throws(() => e.applyAction(g, { type: 'sell', id: p.id, offerId: offer.id }));
});
test('Unemployed managers and stale FA snapshots cannot reopen club contract negotiations', () => {
  const g = e.newGame('kbo-lotte', '권한 QA', 'short', 704),
    p = g.roster[0];
  assert.equal(playerContractContext(g, p).own, true);
  g.deals = [{ id: 'stale', type: 'buy', player: { ...p, club: 'fa' }, status: 'accepted' }];
  assert.equal(playerContractContext(g, p).deal, undefined);
  g.managerCareer.status = 'unemployed';
  assert.equal(playerContractContext(g, p).allowed, false);
  assert.equal(playerContractContext(g, { ...p, club: 'fa' }).allowed, false);
});

test('Detailed positions reflect the strongest current infield/outfield familiarity without exposing unscouted positions', () => {
  const p = e.newGame('kbo-lotte', '포지션 QA', 'short', 799).roster.find((p) => p.pos === 'IF');
  p.familiarity = { '1B': 70, '2B': 75, '3B': 81, SS: 96 };
  assert.equal(playerPosition(p).label, '내야수(유격수)');
  p.familiarity['3B'] = 99;
  assert.equal(playerPosition(p).label, '내야수(3루수)');
  p.pos = 'OF';
  p.familiarity = { LF: 70, CF: 96, RF: 85 };
  assert.equal(playerPosition(p).label, '외야수(중견수)');
  p.observation = { status: 'unknown' };
  assert.equal(playerPosition(p).label, '외야수');
});
