import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfPuppeteerService } from './invoice-pdf-puppeteer.service';
import { InvoicesController } from './invoices.controller';
import { AdminInvoicesController } from './admin-invoices.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoicePdfPuppeteerService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
