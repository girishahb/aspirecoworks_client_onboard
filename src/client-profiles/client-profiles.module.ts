import { Module } from '@nestjs/common';
import { ClientProfilesService } from './client-profiles.service';
import { ClientProfilesController } from './client-profiles.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  controllers: [ClientProfilesController],
  providers: [ClientProfilesService],
  exports: [ClientProfilesService],
  imports: [AuditLogsModule],
})
export class ClientProfilesModule {}
