import type { FinanceEntry } from '@dugout/shared/types';
import { type GameState } from '@dugout/shared/game-view';

export type Act = (action: Record<string, unknown>) => Promise<GameState | null>;

export type CareerData = { state: GameState | null; revision: number; ledger: FinanceEntry[] };
