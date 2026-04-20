import { Module } from '@nestjs/common';
import { AggregatorProfileController } from './aggregator-profile.controller';
import { AggregatorProfileService } from './aggregator-profile.service';

@Module({
  controllers: [AggregatorProfileController],
  providers: [AggregatorProfileService],
  exports: [AggregatorProfileService],
})
export class AggregatorProfileModule {}
