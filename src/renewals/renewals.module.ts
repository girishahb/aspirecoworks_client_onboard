import { Module } from '@nestjs/common';
import { RenewalsService } from './renewals.service';

@Module({
  providers: [RenewalsService],
  exports: [RenewalsService],
})
export class RenewalsModule {}
