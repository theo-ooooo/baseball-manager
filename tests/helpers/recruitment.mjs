import assert from 'node:assert/strict';
export function waitForReply(engine, g, id, coach = false) {
  for (let i = 0; i < 6; i++) {
    const d = (coach ? g.coachDeals : g.deals).find((d) => d.id === id);
    if (d.status !== 'pending') return g;
    g = engine.advance(g, 1);
  }
  assert.fail('Negotiation did not receive a reply within six dates');
}
