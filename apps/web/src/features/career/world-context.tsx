'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createGameView } from '@dugout/shared/game-view';
import type { WorldCatalog } from '@dugout/shared/types';
const WorldContext = createContext<ReturnType<typeof createGameView> | null>(null);
export function WorldProvider({ world, children }: { world: WorldCatalog; children: ReactNode }) {
  const value = useMemo(() => createGameView(world), [world]);
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}
export function useWorld() {
  const value = useContext(WorldContext);
  if (!value) throw new Error('World catalog is not loaded');
  return value;
}
