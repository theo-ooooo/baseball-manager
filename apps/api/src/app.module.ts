import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatalogRepository } from './repositories/catalog.repository';
import { CareerRepository } from './repositories/career.repository';
import { CareerService } from './services/career.service';
@Module({
  controllers: [AppController],
  providers: [CatalogRepository, CareerRepository, CareerService],
})
export class AppModule {}
