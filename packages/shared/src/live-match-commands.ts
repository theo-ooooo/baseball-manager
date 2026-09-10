import type { LiveMatch } from './types';

export const isLiveMatchCommand = (type: unknown) =>
  type === 'matchCommand' || type === 'cancelMatchCommand';

export type LiveMatchPatchResponse = {
  patch: { liveMatch: LiveMatch };
  baseRevision: number;
  revision: number;
};
