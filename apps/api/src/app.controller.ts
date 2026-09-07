import { Controller, Get, Post, Param, Req, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { CareerService } from './services/career.service';
import { CatalogRepository } from './repositories/catalog.repository';

type ApiRequest = { headers: Record<string, string | string[] | undefined>; body: unknown };
function userId(request: ApiRequest) {
  // This deployment is behind Sites dispatch, which owns and sanitizes identity headers.
  const user = request.headers['oai-authenticated-user-id'];
  if (typeof user !== 'string' || !user) throw new UnauthorizedException('로그인 후 다시 시도해 주세요.');
  return user;
}
@Controller('api')
export class AppController {
  constructor(@Inject(CareerService) private readonly careers: CareerService, @Inject(CatalogRepository) private readonly catalog: CatalogRepository) {}
  @Get('health')
  async health() {
    const row = await env.DB.prepare("SELECT value FROM catalog_meta WHERE key='version'").first<{value:string}>();
    if (!row) throw new Error('Catalog not migrated');
    return { status: 'ok', frontend: 'vinext', backend: 'nestjs', database: 'cloudflare-d1', catalogVersion: row.value };
  }
  @Get('catalog')
  async world(@Req() request: ApiRequest) { userId(request); return this.catalog.getWorld(env.DB); }
  @Get('career')
  async career(@Req() request: ApiRequest) { return this.careers.read(env.DB,userId(request)); }
  @Get('career/matches/:id')
  async match(@Req() request: ApiRequest, @Param('id') id: string) { return this.careers.match(env.DB,userId(request),id); }
  @Post('career')
  async action(@Req() request: ApiRequest) {
    const user = userId(request), body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    return this.careers.act(env.DB,user,body as Record<string,unknown>);
  }
}
