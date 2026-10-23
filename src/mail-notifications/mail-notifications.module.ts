import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailNotificationsController } from './mail-notifications.controller';
import { MailNotificationsService } from './mail-notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [MailNotificationsController],
  providers: [MailNotificationsService],
})
export class MailNotificationsModule {}
