import {
  BadRequestException,
  ConflictException,
  Controller,
  HttpCode,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from 'cloudflare:workers';
import { userId, type ApiRequest } from '../auth/api-request';
import { exportCareer } from '../repositories/career-backup';
import { CareerImportError, importCareer } from '../repositories/career-import';

@Controller('api/career')
export class CareerTransferController {
  @Get('export')
  async backup(@Req() request: ApiRequest) {
    return exportCareer(env.DB, userId(request));
  }

  @Post('import')
  @HttpCode(200)
  async restore(@Req() request: ApiRequest) {
    if (request.headers['x-dugout-transfer'] !== 'import')
      throw new UnauthorizedException('데이터 이전 권한이 없습니다.');
    try {
      return await importCareer(env.DB, request.body, userId(request));
    } catch (error) {
      if (error instanceof CareerImportError) {
        if (error.code === 'target_exists' || error.code === 'id_conflict')
          throw new ConflictException(error.message);
        if (error.code === 'invalid_backup') throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
