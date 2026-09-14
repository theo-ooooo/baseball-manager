import { UnauthorizedException, BadRequestException } from '@nestjs/common';

export type ApiRequest = { headers: Record<string, string | string[] | undefined>; body: unknown };

export function userId(request: ApiRequest) {
  // The enclosing Worker authenticates and replaces all internal identity headers.
  const slot = request.headers['x-dugout-career-slot'];
  if (slot && slot !== 'main' && slot !== 'challenge')
    throw new BadRequestException('커리어 저장 종류를 확인해 주세요.');
  const user = request.headers['x-dugout-user-id'];
  if (typeof user !== 'string' || !user)
    throw new UnauthorizedException('저장 정보를 확인할 수 없습니다.');
  return user;
}
