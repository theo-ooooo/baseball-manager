import type { GameState } from '@dugout/shared/types';

/** Browser-tab intent only. Server acknowledgements clear it; date progress persists it. */
export function createInboxReadMemory() {
  let ids = new Set<string>();
  const listeners = new Set<() => void>();
  function replace(next: Set<string>) {
    if (next.size === ids.size && [...next].every((id) => ids.has(id))) return;
    ids = next;
    for (const listener of listeners) listener();
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => ids,
    mark: (next: string[]) => replace(new Set([...ids, ...next])),
    reconcile: (g: GameState | null) => {
      const unread = new Set((g?.news || []).filter((n) => !n.read).map((n) => n.id));
      replace(new Set([...ids].filter((id) => unread.has(id))));
    },
    clear: () => replace(new Set()),
  };
}
