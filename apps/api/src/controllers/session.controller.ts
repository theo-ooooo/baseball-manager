import {
  BadRequestException,
  Controller,
  HttpCode,
  Get,
  NotFoundException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { type ApiRequest } from '../auth/api-request';
import { guestCookie, guestUserId } from '../auth/guest-session';

@Controller('api/session')
export class SessionController {
  @Get()
  current(@Req() request: ApiRequest) {
    const token = request.headers['x-dugout-session-token'];
    return typeof token === 'string' ? { mode: 'guest', recoveryKey: token } : { mode: 'sites' };
  }

  @Post()
  @HttpCode(200)
  async restore(
    @Req() request: ApiRequest,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    if (typeof request.headers['x-dugout-session-token'] !== 'string')
      throw new BadRequestException('게스트 저장에서만 복구 키를 사용할 수 있습니다.');
    const key = (request.body as { recoveryKey?: unknown } | null)?.recoveryKey;
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key))
      throw new BadRequestException('복구 키 형식이 올바르지 않습니다.');
    const career = await env.DB.prepare('SELECT user_id FROM careers WHERE user_id=?')
      .bind(await guestUserId(key))
      .first();
    if (!career) throw new NotFoundException('이 복구 키에 저장된 커리어가 없습니다.');
    response.setHeader('Set-Cookie', guestCookie(key));
    return { restored: true };
  }
}
