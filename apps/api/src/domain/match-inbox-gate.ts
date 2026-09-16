import type { GameState } from '@dugout/shared/types';
import { matchInboxDecision } from '@dugout/shared/match-inbox';
import { pendingReadIds } from '@dugout/shared/inbox-read-intent';

/** Validate external requests before simulation. Explicit holidays and an ongoing delegated series keep their scope. */
export function matchInboxGate(g: GameState, action: Record<string, unknown>, hasFixture: boolean) {
  const startsMatch = ['startMatch', 'delegateMatch', 'beginSeriesDelegation'].includes(
    String(action.type),
  );
  const simulatesMatch =
    action.type === 'advance' ||
    (action.type === 'continue' && hasFixture) ||
    (action.type === 'continueDay' && action.simulateGames === true);
  if (!startsMatch && !simulatesMatch) return null;
  return matchInboxDecision(g, pendingReadIds(action));
}
