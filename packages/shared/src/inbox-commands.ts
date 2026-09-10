import type { GameState } from './types';

export const isInboxReadCommand = (type: unknown) => type === 'readNews' || type === 'readAllNews';
export type InboxReadPatchResponse = {
  patch: Pick<GameState, 'news'>;
  baseRevision: number;
  revision: number;
};
