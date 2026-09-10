import type { CareerData } from './game-contracts';
import type { ManagerPatchResponse } from '@dugout/shared/manager-commands';

/** The server owns mutations; merging a revision-bound view patch is presentation only. */
export function mergeCareerResponse(
  current: CareerData,
  response: CareerData | ManagerPatchResponse,
): CareerData {
  if (!('patch' in response)) return response;
  if (
    !current.state ||
    response.baseRevision !== current.revision ||
    response.revision !== current.revision + 1
  )
    throw new Error('화면의 저장 버전이 달라졌습니다. 최신 커리어를 다시 불러와 주세요.');
  return {
    ...current,
    revision: response.revision,
    state: {
      ...current.state,
      managerCareer: response.patch.managerCareer,
      news: response.patch.news,
    },
  };
}
export async function careerResponse(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    // Cloudflare resource failures are HTML. Do not surface a JSON parser error to the manager.
    throw new Error(
      response.status >= 500
        ? '서버 처리가 중단됐습니다. 잠시 후 다시 시도해 주세요. 저장한 진행 상황을 다시 확인합니다.'
        : '서버 응답을 읽지 못했습니다. 페이지를 새로고침해 주세요.',
    );
  }
  return response.json();
}
