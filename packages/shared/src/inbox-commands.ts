import type { GameState } from './types';

export const isInboxReadCommand = (type: unknown) => type === 'readNews' || type === 'readAllNews';
export const isInboxCommand = (type: unknown) => isInboxReadCommand(type) || type === 'respondNews';
export type InboxReadPatchResponse = {
  patch: Pick<GameState, 'news'> & {
    playerMood?: { id: string; mood: NonNullable<GameState['roster'][number]['mood']> };
  };
  baseRevision: number;
  revision: number;
};
