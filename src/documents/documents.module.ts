import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AuditLogsModule, StorageModule, EmailModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
