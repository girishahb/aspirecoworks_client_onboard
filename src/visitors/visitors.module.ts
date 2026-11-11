import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { VisitorsController } from './visitors.controller';
import { AdminVisitorsController } from './admin-visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [VisitorsController, AdminVisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
