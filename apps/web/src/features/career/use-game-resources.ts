'use client';
import { careerFetch, rememberCareerSlot } from './career-slot';
import { useEffect, useState } from 'react';
import type { WorldCatalog } from '@dugout/shared/types';
import type { CareerData } from './game-contracts';
import { careerMemory } from './career-memory';
import { careerResponse, careerErrorMessage } from './career-response';

async function read(path: string) {
  const response = await careerFetch(path, { cache: 'no-store' });
  const value = await careerResponse(response);
  if (!response.ok) throw new Error(value.error || '데이터를 불러오지 못했습니다.');
  return value;
}
export function useGameResources() {
  const [data, setData] = useState<{ world: WorldCatalog; career: CareerData } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    rememberCareerSlot();
    careerMemory
      .load(async () => {
        const [world, career] = await Promise.all([read('/api/catalog'), read('/api/career')]);
        return { world, career };
      })
      .then((resources) => {
        if (active) setData(resources);
      })
      .catch((e) => {
        if (active) setError(careerErrorMessage(e));
      });
    // A route may unmount while another route uses the same read. Only stop this subscriber.
    return () => {
      active = false;
    };
  }, [attempt]);
  function reconnect() {
    careerMemory.clear();
    setError('');
    setAttempt((n) => n + 1);
  }
  async function refreshCatalog() {
    const world = (await read('/api/catalog')) as WorldCatalog;
    careerMemory.world(world);
    setData((current) => (current ? { ...current, world } : current));
  }
  return { data, error, reconnect, refreshCatalog };
}
