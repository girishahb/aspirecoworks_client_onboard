import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { TicketsService } from './tickets.service';
import { TicketMailService } from './ticket-mail.service';
import { PublicTicketsController } from './public-tickets.controller';
import { StaffTicketsController } from './staff-tickets.controller';
import { AdminTicketsController } from './admin-tickets.controller';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [PublicTicketsController, StaffTicketsController, AdminTicketsController],
  providers: [TicketsService, TicketMailService],
})
export class TicketsModule {}
