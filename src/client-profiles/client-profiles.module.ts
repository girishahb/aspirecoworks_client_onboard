import { Module } from '@nestjs/common';
import { ClientProfilesService } from './client-profiles.service';
import { ClientProfilesController } from './client-profiles.controller';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { StorageModule } from '../storage/storage.module';
import { AggregatorProfileModule } from '../aggregator-profile/aggregator-profile.module';

@Module({
  controllers: [ClientProfilesController, AdminCompaniesController, AdminDashboardController],
  providers: [ClientProfilesService],
  exports: [ClientProfilesService],
  imports: [
    AuditLogsModule,
    EmailModule,
    OnboardingModule,
    StorageModule,
    AggregatorProfileModule,
  ],
})
export class ClientProfilesModule {}
