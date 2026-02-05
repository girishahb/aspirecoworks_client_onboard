import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { AdminKycController } from './admin-kyc.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { ClientProfilesModule } from '../client-profiles/client-profiles.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    AuditLogsModule,
    StorageModule,
    EmailModule,
    ClientProfilesModule,
    OnboardingModule,
  ],
  controllers: [DocumentsController, AdminKycController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
