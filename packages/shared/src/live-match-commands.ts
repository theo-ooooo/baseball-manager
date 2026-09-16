import type { LiveMatch } from './types';

export const isLiveMatchCommand = (type: unknown) =>
  type === 'delegateInning' ||
  type === 'matchCommand' ||
  type === 'cancelMatchCommand' ||
  type === 'chooseMatchCards' ||
  type === 'useMatchCard';

export type LiveMatchPatchResponse = {
  patch: { liveMatch: LiveMatch };
  baseRevision: number;
  revision: number;
};
