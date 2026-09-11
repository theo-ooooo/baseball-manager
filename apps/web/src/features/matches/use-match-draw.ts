'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export function useMatchDraw(id: string, automatic = false) {
  const [phase, setPhase] = useState<'ready' | 'drawing' | 'revealed'>(
    automatic ? 'drawing' : 'ready',
  );
  const reduced = useReducedMotion();
  const key = `dugout:${automatic ? 'augmentation' : 'card'}-reveal`;
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === id;
    } catch {
      /* Animation still works without storage. */
    }
    if (phase !== 'drawing' && !seen) return;
    const timer = setTimeout(
      () => {
        setPhase('revealed');
        try {
          sessionStorage.setItem(key, id);
        } catch {
          /* Cosmetic preference only. */
        }
      },
      seen || reduced ? 0 : automatic ? 1450 : 1350,
    );
    return () => clearTimeout(timer);
  }, [phase, id, key, automatic, reduced]);
  return { phase, draw: () => setPhase('drawing') };
}
