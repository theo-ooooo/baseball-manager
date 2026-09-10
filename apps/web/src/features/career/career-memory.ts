import type { WorldCatalog } from '@dugout/shared/types';
import type { CareerData } from './game-contracts';

type Resources = { world: WorldCatalog; career: CareerData };
/** Tab memory only; never persisted to disk, rendered into SSR or shared between users. */
export function createCareerMemory(now = Date.now) {
  let value: Resources | null = null;
  let fetchedAt = 0;
  let generation = 0;
  let pending: Promise<Resources> | null = null;
  const visibility = (career: CareerData) =>
    JSON.stringify([
      career.state?.club,
      career.state?.rules?.revealPotential,
      career.state?.knowledge,
      career.state?.scouting?.reports,
    ]);
  return {
    async load(fetcher: () => Promise<Resources>) {
      if (value && now() - fetchedAt < 30_000) return value;
      if (pending) return pending;
      const epoch = generation;
      const request = fetcher()
        .then((resources) => {
          if (generation !== epoch)
            throw new Error('저장 정보가 변경됐습니다. 다시 연결해 주세요.');
          value = resources;
          fetchedAt = now();
          return resources;
        })
        .finally(() => {
          if (pending === request) pending = null;
        });
      pending = request;
      return request;
    },
    career(career: CareerData) {
      generation++;
      pending = null;
      if (!value) return;
      if (visibility(value.career) !== visibility(career)) {
        value = null;
        return;
      }
      value = { ...value, career };
    },
    world(world: WorldCatalog) {
      if (value) value = { ...value, world };
    },
    clear() {
      generation++;
      value = null;
      pending = null;
      fetchedAt = 0;
    },
  };
}
// Methods are called only from client effects/events. Server rendering never populates this.
export const careerMemory = createCareerMemory();
