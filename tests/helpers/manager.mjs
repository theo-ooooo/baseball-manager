import assert from 'node:assert/strict';
export function finishInterview(engine, game, id) {
  let g = game;
  let offer = g.managerCareer.offers.find((o) => o.id === id);
  if (offer.status === 'invited') g = engine.applyAction(g, { type: 'acceptManagerInvite', id });
  const answers = [
    ['motivation', 'project'],
    ['career', 'responsibility'],
    ['style', offer.priority || 'win'],
    ['target', 'agree'],
    ['budget', 'within'],
    ['staff', 'keep'],
  ];
  for (const [question, answer] of answers.slice(offer.interview?.length || 0))
    g = engine.applyAction(g, { type: 'managerInterview', id, question, answer });
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'pending');
  for (let i = 0; i < 2; i++) g = engine.applyAction(g, { type: 'managerContinue' });
  assert.equal(g.managerCareer.offers.find((o) => o.id === id).status, 'offered');
  return g;
}
export function signManager(engine, game, id) {
  let g = engine.applyAction(game, {
    type: 'acceptManagerTerms',
    id,
    termsVersion: game.managerCareer.offers.find((o) => o.id === id).contractTerms?.version || 1,
  });
  return engine.applyAction(g, {
    type: 'signManager',
    id,
    termsVersion: g.managerCareer.offers.find((o) => o.id === id).contractTerms.version,
    signature: g.manager,
  });
}
export function reachFixture(engine, game) {
  let g = game;
  for (let i = 0; i < 35 && !engine.nextFixture(g); i++)
    g = engine.applyAction(g, { type: 'continue' });
  assert.ok(engine.nextFixture(g), 'Expected a fixture within 35 progress stops');
  return g;
}
