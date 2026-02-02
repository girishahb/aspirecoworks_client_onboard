import { Module } from '@nestjs/common';
import { RenewalsService } from './renewals.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [RenewalsService],
  exports: [RenewalsService],
})
export class RenewalsModule {}
