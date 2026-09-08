import { Controller, Get, Inject, Req } from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { userId, type ApiRequest } from '../auth/api-request';
import { CareerService } from '../services/career.service';
import { CatalogRepository } from '../repositories/catalog.repository';
import { presentWorld } from '../services/presentation';

@Controller('api/catalog')
export class CatalogController {
  constructor(
    @Inject(CareerService) private readonly careers: CareerService,
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
  ) {}

  @Get()
  async world(@Req() request: ApiRequest) {
    const user = userId(request);
    const [world, career] = await Promise.all([
      this.catalog.getWorld(env.DB),
      this.careers.read(env.DB, user),
    ]);
    return presentWorld(world, career.state?.rules?.revealPotential === true);
  }
}
