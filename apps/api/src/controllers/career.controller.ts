import { isManagerConversationCommand } from '@dugout/shared/manager-commands';
import { ManagerConversationService } from '../services/manager-conversation.service';
import { BadRequestException, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { userId, type ApiRequest } from '../auth/api-request';
import { CareerService } from '../services/career.service';
import { presentCareer } from '../services/presentation';

@Controller('api/career')
export class CareerController {
  constructor(
    @Inject(CareerService) private readonly careers: CareerService,
    @Inject(ManagerConversationService) private readonly conversations: ManagerConversationService,
  ) {}

  @Get()
  async career(@Req() request: ApiRequest) {
    return presentCareer(await this.careers.read(env.DB, userId(request)));
  }

  @Get('matches/:id')
  async match(@Req() request: ApiRequest, @Param('id') id: string) {
    return this.careers.match(env.DB, userId(request), id);
  }

  @Post()
  async action(@Req() request: ApiRequest) {
    const user = userId(request),
      body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    const action = body as Record<string, unknown>;
    if (action.responseMode === 'patch' && isManagerConversationCommand(action.type)) {
      const response = await this.conversations.act(env.DB, user, action);
      if (response) return response;
    }
    return presentCareer(
      await this.careers.act(env.DB, user, action),
      action.responseMode === 'compact' || action.responseMode === 'patch',
    );
  }
}
