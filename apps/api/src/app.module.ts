import { ManagerConversationRepository } from './repositories/manager-conversation.repository';
import { ManagerConversationService } from './services/manager-conversation.service';
import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { CatalogController } from './controllers/catalog.controller';
import { CareerController } from './controllers/career.controller';
import { CareerTransferController } from './controllers/career-transfer.controller';
import { SessionController } from './controllers/session.controller';
import { PlayerRecordsController } from './controllers/player-records.controller';
import { CatalogRepository } from './repositories/catalog.repository';
import { CareerRepository } from './repositories/career.repository';
import { CareerService } from './services/career.service';
@Module({
  controllers: [
    HealthController,
    CatalogController,
    CareerController,
    CareerTransferController,
    SessionController,
    PlayerRecordsController,
  ],
  providers: [
    CatalogRepository,
    CareerRepository,
    CareerService,
    ManagerConversationRepository,
    ManagerConversationService,
  ],
})
export class AppModule {}
