import { BadRequestException, Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { userId, type ApiRequest } from '../auth/api-request';
import { CareerRepository } from '../repositories/career.repository';

@Controller('api/records')
export class PlayerRecordsController {
  constructor(@Inject(CareerRepository) private readonly careers: CareerRepository) {}
  @Get('retired')
  async retired(@Req() request: ApiRequest, @Query('offset') offset = '0') {
    const page = Number(offset);
    if (!Number.isInteger(page) || page < 0 || page > 100000)
      throw new BadRequestException('기록 페이지가 올바르지 않습니다.');
    return this.careers.retiredPlayers(env.DB, userId(request), page);
  }
  @Get(':id')
  async records(@Req() request: ApiRequest, @Param('id') id: string) {
    if (id.length > 160) throw new BadRequestException('선수 식별자가 올바르지 않습니다.');
    return this.careers.playerRecords(env.DB, userId(request), id);
  }
}
