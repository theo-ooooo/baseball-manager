import { buildSeedWorld } from '../../apps/api/seed/world';
import { createGameEngine } from '../../apps/api/src/domain/game-engine';
import * as view from '../../packages/shared/src/game-view';
export const world = buildSeedWorld();
export const engine = { ...view, ...view.createGameView(world), ...createGameEngine(world) };
export { detailedAttributes, lineupReason } from '../../packages/shared/src/player-attributes';
