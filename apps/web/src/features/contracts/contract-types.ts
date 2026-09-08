import type { GameState, Player } from '@dugout/shared/types';
import type { Act } from '../career/game-contracts';
export type PlayerContractProps = { player: Player; g: GameState; act: Act; busy: boolean };
