import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AuditLogsModule, EmailModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

