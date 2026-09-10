import type { CareerData } from './game-contracts';
import type { ManagerPatchResponse } from '@dugout/shared/manager-commands';
import type { InboxReadPatchResponse } from '@dugout/shared/inbox-commands';

/** The server owns mutations; merging a revision-bound view patch is presentation only. */
export function mergeCareerResponse(
  current: CareerData,
  response: CareerData | ManagerPatchResponse | InboxReadPatchResponse,
): CareerData {
  if (!('patch' in response)) return response;
  if (
    !current.state ||
    response.baseRevision !== current.revision ||
    response.revision !== current.revision + 1
  )
    throw new Error('화면의 저장 버전이 달라졌습니다. 최신 커리어를 다시 불러와 주세요.');
  const playerMood = 'playerMood' in response.patch ? response.patch.playerMood : undefined;
  return {
    ...current,
    revision: response.revision,
    state: {
      ...current.state,
      managerCareer:
        'managerCareer' in response.patch
          ? response.patch.managerCareer
          : current.state.managerCareer,
      news: response.patch.news,
      roster: playerMood
        ? current.state.roster.map((p) =>
            p.id === playerMood.id ? { ...p, mood: playerMood.mood } : p,
          )
        : current.state.roster,
    },
  };
}
export const temporaryServiceMessage =
  '일시적으로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
export function careerErrorMessage(error: unknown) {
  return error instanceof TypeError || !(error instanceof Error)
    ? temporaryServiceMessage
    : error.message;
}
export async function careerResponse(response: Response) {
  if (response.status >= 500 || response.status === 429) {
    const text = await response.text();
    if (/\b1027\b|daily request limit/i.test(text))
      throw new Error(
        '오늘의 서비스 이용량 한도에 도달했습니다. 한국 시간 오전 9시 이후 다시 시도해 주세요.',
      );
    throw new Error(temporaryServiceMessage);
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(temporaryServiceMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(temporaryServiceMessage);
  }
}
