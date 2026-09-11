import { buildSeedWorld } from '../../apps/api/seed/world';
import { createGameEngine } from '../../apps/api/src/domain/game-engine';
import * as view from '@dugout/shared/game-view';
import { freeAgentValuation } from '../../apps/api/src/domain/free-agent-valuation';
export const world = buildSeedWorld();
export const engine = {
  ...view,
  ...view.createGameView(world),
  ...createGameEngine(world),
  faDemand(g: import('@dugout/shared/types').GameState, p: import('@dugout/shared/types').Player) {
    return freeAgentValuation(g, p, world.clubs.find((c) => c.id === g.club)!.league).salary;
  },
  acceptRenewal(g: import('@dugout/shared/types').GameState) {
    const offer = g.managerCareer?.offers.find(
      (o) => o.source === 'renewal' && o.status === 'offered',
    );
    if (!offer) return g;
    let next = createGameEngine(world).applyAction(g, {
      type: 'acceptManagerTerms',
      id: offer.id,
      termsVersion: offer.contractTerms!.version,
    });
    const terms = next.managerCareer!.offers.find((o) => o.id === offer.id)!.contractTerms!;
    next = createGameEngine(world).applyAction(next, {
      type: 'signManager',
      id: offer.id,
      termsVersion: terms.version,
      signature: next.manager,
    });
    return next;
  },
};
export { detailedAttributes, lineupReason } from '@dugout/shared/player-attributes';
