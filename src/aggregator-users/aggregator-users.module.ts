import { Module } from '@nestjs/common';
import { AggregatorUsersController } from './aggregator-users.controller';
import { AggregatorUsersService } from './aggregator-users.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [AggregatorUsersController],
  providers: [AggregatorUsersService],
  exports: [AggregatorUsersService],
})
export class AggregatorUsersModule {}
