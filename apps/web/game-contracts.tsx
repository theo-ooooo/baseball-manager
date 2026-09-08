import type { FinanceEntry } from '../../packages/shared/src/types';
import { type GameState } from '../../packages/shared/src/game-view';

export type Act = (action: Record<string, unknown>) => Promise<GameState | null>;

export type CareerData = { state: GameState | null; revision: number; ledger: FinanceEntry[] };
