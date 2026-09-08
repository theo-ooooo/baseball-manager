import { Controller, Get, Inject, Req } from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { userId, type ApiRequest } from '../auth/api-request';
import { CareerRepository } from '../repositories/career.repository';
import { CatalogRepository } from '../repositories/catalog.repository';
import { presentWorld } from '../services/presentation';

@Controller('api/catalog')
export class CatalogController {
  constructor(
    @Inject(CareerRepository) private readonly careers: CareerRepository,
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
  ) {}

  @Get()
  async world(@Req() request: ApiRequest) {
    const user = userId(request);
    const [world, reveal] = await Promise.all([
      this.catalog.getWorld(env.DB),
      this.careers.revealsPotential(env.DB, user),
    ]);
    return presentWorld(world, reveal);
  }
}
