import { Controller, Get } from '@nestjs/common';
import { env } from 'cloudflare:workers';

@Controller('api/health')
export class HealthController {
  @Get()
  async health() {
    const row = await env.DB.prepare("SELECT value FROM catalog_meta WHERE key='version'").first<{
      value: string;
    }>();
    if (!row) throw new Error('Catalog not migrated');
    return {
      status: 'ok',
      frontend: 'vinext',
      backend: 'nestjs',
      database: 'cloudflare-d1',
      catalogVersion: row.value,
    };
  }
}
