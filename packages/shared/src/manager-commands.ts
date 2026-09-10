import type { GameState } from './types';

/** These commands only change the manager conversation and its inbox messages. */
export const managerConversationCommands = [
  'managerInterview',
  'acceptManagerInvite',
  'submitManagerProposal',
  'finishManagerInterview',
  'declineManager',
  'negotiateManagerContract',
  'acceptManagerTerms',
] as const;
export const isManagerConversationCommand = (type: unknown) =>
  managerConversationCommands.some((command) => command === type);
export type ManagerConversationState = Pick<
  GameState,
  'year' | 'day' | 'managerCareer' | 'managerJobs' | 'news'
> & {
  calendar?: Pick<NonNullable<GameState['calendar']>, 'openingDate'>;
  liveMatch?: unknown;
};
export type ManagerConversationPatch = Pick<GameState, 'managerCareer' | 'news'>;
export type ManagerPatchResponse = {
  patch: ManagerConversationPatch;
  baseRevision: number;
  revision: number;
};
