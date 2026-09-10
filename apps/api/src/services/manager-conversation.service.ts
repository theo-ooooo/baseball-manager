import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { managerConversationAction } from '../domain/manager-conversation';
import { ManagerConversationRepository } from '../repositories/manager-conversation.repository';
import type { ManagerPatchResponse } from '@dugout/shared/manager-commands';

@Injectable()
export class ManagerConversationService {
  constructor(
    @Inject(ManagerConversationRepository)
    private readonly conversations: ManagerConversationRepository,
  ) {}
  async act(
    db: D1Database,
    user: string,
    action: Record<string, unknown>,
  ): Promise<ManagerPatchResponse | null> {
    const requestId =
      typeof action.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(action.requestId)
        ? action.requestId
        : crypto.randomUUID();
    const current = await this.conversations.read(db, user, requestId, String(action.id));
    // Older saves still use the full migration/normalization path once.
    if (!current.state?.managerCareer || !current.state.managerJobs || !current.state.news)
      return null;
    const expected = Number(action.revision);
    const conflict = () =>
      new ConflictException({
        error: '다른 화면에서 변경됐습니다. 최신 커리어를 불러와 주세요.',
        reload: true,
      });
    if (!Number.isInteger(expected)) throw conflict();
    if (current.seenRevision !== undefined) {
      // A lost response may be retried with its original request id. Never replay an old patch
      // over later changes; the client must reload when the journal has moved on.
      if (current.seenRevision !== expected + 1 || current.revision !== current.seenRevision)
        throw conflict();
      return {
        baseRevision: expected,
        revision: current.revision,
        patch: { managerCareer: current.state.managerCareer, news: current.state.news },
      };
    }
    if (current.revision !== expected) throw conflict();
    if (!current.club) throw new BadRequestException('진행 중인 채용 제안이 없습니다.');
    try {
      managerConversationAction(current.state, action, current.club);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '잘못된 요청입니다.');
    }
    const patch = { managerCareer: current.state.managerCareer, news: current.state.news };
    if (!(await this.conversations.save(db, user, expected, patch, String(action.type), requestId)))
      throw conflict();
    return { patch, baseRevision: expected, revision: expected + 1 };
  }
}
